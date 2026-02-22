package com.project.platform.controller;

import com.project.platform.entity.ProductCollect;
import com.project.platform.entity.ShopCollect;
import com.project.platform.service.ShopCollectService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 店铺收藏
 */
@RestController
@RequestMapping("/shopCollect")
public class ShopCollectController {
    @Resource
    private ShopCollectService shopCollectService;

    /**
     * 分页查询
     *
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    @GetMapping("page")
    public ResponseVO<PageVO<ShopCollect>> page(@RequestParam Map<String, Object> query, @RequestParam(defaultValue = "1") Integer pageNum, @RequestParam(defaultValue = "10") Integer pageSize) {
        PageVO<ShopCollect> page = shopCollectService.page(query, pageNum, pageSize);
        return ResponseVO.ok(page);

    }

    /**
     * 根据id查询
     *
     * @param id
     * @return
     */
    @GetMapping("selectById/{id}")
    public ResponseVO<ShopCollect> selectById(@PathVariable("id") Integer id) {
        ShopCollect entity = shopCollectService.selectById(id);
        return ResponseVO.ok(entity);
    }


    /**
     * 列表
     *
     * @return
     */
    @GetMapping("list")
    public ResponseVO<List<ShopCollect>> list() {
        return ResponseVO.ok(shopCollectService.list());
    }


    /**
     * 新增
     *
     * @param entity
     * @return
     */
    @PostMapping("add")
    public ResponseVO add(@RequestBody ShopCollect entity) {
        shopCollectService.insert(entity);
        return ResponseVO.ok();
    }

    /**
     * 更新
     *
     * @param entity
     * @return
     */
    @PutMapping("update")
    public ResponseVO update(@RequestBody ShopCollect entity) {
        shopCollectService.updateById(entity);
        return ResponseVO.ok();
    }

    /**
     * 批量删除
     *
     * @param ids
     * @return
     */
    @DeleteMapping("delBatch")
    public ResponseVO delBatch(@RequestBody List<Integer> ids) {
        shopCollectService.removeByIds(ids);
        return ResponseVO.ok();
    }
}
