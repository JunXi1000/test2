package com.project.platform.controller;

import com.project.platform.entity.ProductBrowsingHistory;
import com.project.platform.service.ProductBrowsingHistoryService;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 商品浏览历史
 */
@RestController
@RequestMapping("/productBrowsingHistory")
public class ProductBrowsingHistoryController {
    @Resource
    private ProductBrowsingHistoryService productBrowsingHistoryService;

    /**
     * 分页查询
     *
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    @GetMapping("page")
    public ResponseVO<PageVO<ProductBrowsingHistory>> page(@RequestParam Map<String, Object> query, @RequestParam(defaultValue = "1") Integer pageNum, @RequestParam(defaultValue = "10") Integer pageSize) {
        PageVO<ProductBrowsingHistory> page = productBrowsingHistoryService.page(query, pageNum, pageSize);
        return ResponseVO.ok(page);

    }

    /**
     * 根据id查询
     *
     * @param id
     * @return
     */
    @GetMapping("selectById/{id}")
    public ResponseVO<ProductBrowsingHistory> selectById(@PathVariable("id") Integer id) {
        ProductBrowsingHistory entity = productBrowsingHistoryService.selectById(id);
        return ResponseVO.ok(entity);
    }


    /**
     * 列表
     *
     * @return
     */
    @GetMapping("list")
    public ResponseVO<List<ProductBrowsingHistory>> list() {
        return ResponseVO.ok(productBrowsingHistoryService.list());
    }


    /**
     * 新增
     *
     * @param entity
     * @return
     */
    @PostMapping("add")
    public ResponseVO add(@RequestBody ProductBrowsingHistory entity) {
        productBrowsingHistoryService.insert(entity);
        return ResponseVO.ok();
    }

    /**
     * 更新
     *
     * @param entity
     * @return
     */
    @PutMapping("update")
    public ResponseVO update(@RequestBody ProductBrowsingHistory entity) {
        productBrowsingHistoryService.updateById(entity);
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
        productBrowsingHistoryService.removeByIds(ids);
        return ResponseVO.ok();
    }
}
