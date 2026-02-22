package com.project.platform.controller;

import com.project.platform.entity.ProductOrderEvaluate;
import com.project.platform.service.ProductOrderEvaluateService;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 订单评价
 */
@RestController
@RequestMapping("/productOrderEvaluate")
public class ProductOrderEvaluateController {
    @Resource
    private ProductOrderEvaluateService productOrderEvaluateService;

    /**
     * 分页查询
     *
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    @GetMapping("page")
    public ResponseVO<PageVO<ProductOrderEvaluate>> page(@RequestParam Map<String, Object> query, @RequestParam(defaultValue = "1") Integer pageNum, @RequestParam(defaultValue = "10") Integer pageSize) {
        PageVO<ProductOrderEvaluate> page = productOrderEvaluateService.page(query, pageNum, pageSize);
        return ResponseVO.ok(page);

    }

    /**
     * 根据id查询
     *
     * @param id
     * @return
     */
    @GetMapping("selectById/{id}")
    public ResponseVO<ProductOrderEvaluate> selectById(@PathVariable("id") Integer id) {
        ProductOrderEvaluate entity = productOrderEvaluateService.selectById(id);
        return ResponseVO.ok(entity);
    }


    /**
     * 列表
     *
     * @return
     */
    @GetMapping("list")
    public ResponseVO<List<ProductOrderEvaluate>> list() {
        return ResponseVO.ok(productOrderEvaluateService.list());
    }


    /**
     * 新增
     *
     * @param entity
     * @return
     */
    @PostMapping("add")
    public ResponseVO add(@RequestBody ProductOrderEvaluate entity) {
        productOrderEvaluateService.insert(entity);
        return ResponseVO.ok();
    }

    /**
     * 更新
     *
     * @param entity
     * @return
     */
    @PutMapping("update")
    public ResponseVO update(@RequestBody ProductOrderEvaluate entity) {
        productOrderEvaluateService.updateById(entity);
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
        productOrderEvaluateService.removeByIds(ids);
        return ResponseVO.ok();
    }
}

