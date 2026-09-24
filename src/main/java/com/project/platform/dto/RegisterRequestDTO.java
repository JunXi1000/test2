package com.project.platform.dto;

import lombok.Data;

/**
 * 自助注册(PUT /common/register)的入参。
 *
 * <p>字段是三个实现({@code UserServiceImpl} / {@code ShopServiceImpl} / {@code AdminServiceImpl})
 * 所读 key 的**并集** —— 各实现只读自己那几个,其余为 null。
 * 注意:控制器只放行 {@code type=USER},另两条路径(商家入驻、匿名建管理员)当前**不可达**,
 * 它们的存在是纵深防御,字段一并保留以免改动它们的行为。
 *
 * <p>**不加新校验**:各实现原有的校验(用户名非空/长度、密码长度、邮箱格式,均返回 400)
 * 原样保留在 service 里,状态码与文案不变。
 */
@Data
public class RegisterRequestDTO {
    /** ADMIN / USER / SHOP;控制器只放行 USER */
    private String type;
    private String username;
    private String password;
    private String nickname;
    /** 前端把邮箱既当 username 又作为 email 传入 */
    private String email;
    private String avatarUrl;
    /** 仅 SHOP 用:资质图 */
    private String aptitudeImgs;
    /** 仅 SHOP 用:店铺名 */
    private String name;
}
