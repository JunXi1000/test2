package com.project.platform.controller;

import com.project.platform.entity.Shop;
import com.project.platform.service.ShopService;
import com.project.platform.utils.CurrentUserThreadLocal;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
/**
 * 店铺
 */
@RestController
@RequestMapping("/shop")
public class ShopController {
    @Resource
    private ShopService shopService;

    /**
     * 分页查询
     *
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    @GetMapping("page")
    public ResponseVO<PageVO<Shop>> page(@RequestParam Map<String, Object> query, @RequestParam(defaultValue = "1") Integer pageNum, @RequestParam(defaultValue = "10") Integer pageSize) {
        PageVO<Shop> page = shopService.page(query, pageNum, pageSize);
        return ResponseVO.ok(page);

    }

    /**
     * 根据id查询
     *
     * @param id
     * @return
     */
    @GetMapping("selectById/{id}")
    public ResponseVO<Shop> selectById(@PathVariable("id") Integer id) {
        Shop entity = shopService.selectById(id);
        return ResponseVO.ok(entity);
    }


    /**
     * 列表
     *
     * @return
     */
    @GetMapping("list")
    public ResponseVO<List<Shop>> list() {
        return ResponseVO.ok(shopService.list());
    }


    /**
     * 新增
     *
     * @param entity
     * @return
     */
    @PostMapping("add")
    public ResponseVO add(@RequestBody Shop entity) {
        shopService.insert(entity);
        return ResponseVO.ok();
    }

    /**
     * 更新
     *
     * @param entity
     * @return
     */
    @PutMapping("update")
    public ResponseVO update(@RequestBody Shop entity) {
        shopService.updateById(entity);
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
        shopService.removeByIds(ids);
        return ResponseVO.ok();
    }
}
