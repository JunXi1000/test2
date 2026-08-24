package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import com.project.platform.dto.CurrentUserDTO;
import com.project.platform.dto.LoginDTO;
import com.project.platform.dto.RetrievePasswordDTO;
import com.project.platform.dto.UpdatePasswordDTO;
import com.project.platform.exception.CustomException;
import com.project.platform.service.AdminService;
import com.project.platform.service.CommonService;
import com.project.platform.service.ShopService;
import com.project.platform.service.UserService;
import com.project.platform.service.impl.ResetCodeStore;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.utils.JwtUtils;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * 通用
 */
@RestController
@RequestMapping("/common")
public class CommonController {

    @Resource
    private AdminService adminService;

    @Resource
    private UserService userService;

    @Resource
    private ShopService shopService;

    @Resource
    private ResetCodeStore resetCodeStore;

    /**
     * 是否在响应中直接返回验证码(演示环境默认开启,便于页面展示)。
     * 接入真实短信/邮件后应关闭并改为下发:prod profile 默认 false。
     */
    @Value("${security.expose-reset-code:true}")
    private boolean exposeResetCode;

    /**
     * 登录
     *
     * @param loginDTO
     * @return
     */

    @PostMapping("login")
    public ResponseVO<String> login(@Valid @RequestBody LoginDTO loginDTO) {
        CommonService commonService = getCommonService(loginDTO.getType());
        CurrentUserDTO currentUserDTO = commonService.login(loginDTO.getUsername(), loginDTO.getPassword());
        currentUserDTO.setType(loginDTO.getType());
        String token = JwtUtils.generateToken(currentUserDTO);
        return ResponseVO.ok(token);
    }

    /**
     * 注册
     *
     * @param data
     */

    @PutMapping("register")
    public ResponseVO register(@RequestBody JSONObject data) {
        String type = data.getString("type");
        // 仅允许普通用户自助注册;SHOP 走商家入驻审核,ADMIN 一律拒绝,杜绝匿名建管理员
        if (!"USER".equals(type)) {
            throw new CustomException(HttpStatus.FORBIDDEN, "仅支持普通用户注册");
        }
        CommonService commonService = getCommonService(type);
        commonService.register(data);
        return ResponseVO.ok();
    }

    /**
     * 修改当前用户信息
     *
     * @param currentUserDTO
     */

    @PostMapping("updateCurrentUser")
    public ResponseVO updateCurrentUser(@Valid @RequestBody CurrentUserDTO currentUserDTO) {
        CommonService commonService = getCommonService(CurrentUserThreadLocal.getCurrentUser().getType());
        commonService.updateCurrentUserInfo(currentUserDTO);
        return ResponseVO.ok();
    }

    /**
     * 修改密码
     *
     * @param updatePassword
     */

    @PostMapping("updatePassword")
    public ResponseVO updatePassword(@Valid @RequestBody UpdatePasswordDTO updatePassword) {
        CommonService commonService = getCommonService(CurrentUserThreadLocal.getCurrentUser().getType());
        commonService.updateCurrentUserPassword(updatePassword);
        return ResponseVO.ok();
    }

    /**
     * 发送找回密码验证码。
     * 演示环境默认直接返回验证码,便于页面展示(security.expose-reset-code=true);
     * 接入真实短信后应改为下发,此时仅返回提示文案。
     *
     * @param data {type, tel}
     */
    @PostMapping("sendResetCode")
    public ResponseVO<String> sendResetCode(@RequestBody JSONObject data) {
        String type = data.getString("type");
        String tel = data.getString("tel");
        if (type == null || type.isEmpty() || tel == null || tel.isEmpty()) {
            throw new CustomException("用户类型与手机号不能为空");
        }
        String code = resetCodeStore.send(type, tel);
        return ResponseVO.ok(exposeResetCode ? code : "验证码已发送");
    }

    /**
     * 忘记密码
     * @param retrievePasswordDTO
     * @return
     */

    @PostMapping("retrievePassword")
    public ResponseVO retrievePassword(@Valid @RequestBody RetrievePasswordDTO retrievePasswordDTO) {
        CommonService commonService = getCommonService(retrievePasswordDTO.getType());
        commonService.retrievePassword(retrievePasswordDTO);
        return ResponseVO.ok();
    }

    /**
     * 重置密码
     *
     * @param type
     * @param id
     */

    @PostMapping("resetPassword")
    public ResponseVO resetPassword(@RequestParam String type, @RequestParam Integer id) {
        // 重置他人密码为默认值属后台能力,仅管理员可用;普通用户找回密码走 retrievePassword(带验证码)
        CurrentUserDTO current = CurrentUserThreadLocal.getCurrentUser();
        if (current == null || !"ADMIN".equals(current.getType())) {
            throw new CustomException(HttpStatus.FORBIDDEN, "仅管理员可重置密码");
        }
        CommonService commonService = getCommonService(type);
        commonService.resetPassword(id);
        return ResponseVO.ok();
    }


    /**
     * 获取当前用户
     *
     * @return
     */
    @GetMapping("currentUser")
    public ResponseVO<CurrentUserDTO> getCurrentUser() {
        Integer userId = CurrentUserThreadLocal.getCurrentUser().getId();
        CommonService commonService = getCommonService(CurrentUserThreadLocal.getCurrentUser().getType());
        CurrentUserDTO currentUserDTO = new CurrentUserDTO();
        BeanUtils.copyProperties(commonService.selectById(userId), currentUserDTO);
        currentUserDTO.setType(CurrentUserThreadLocal.getCurrentUser().getType());
        return ResponseVO.ok(currentUserDTO);
    }

    /**
     * 根据类型获取对应service
     *
     * @param type
     * @return
     */

    private CommonService getCommonService(String type) {
        if (type == null || type.isEmpty()) {
            throw new CustomException("用户类型不能为空");
        }
        switch (type) {
            case "ADMIN":
                return adminService;
            case "USER":
                return userService;
            case "SHOP":
                return shopService;
            default:
                throw new CustomException("用户类型错误");
        }
    }
}
