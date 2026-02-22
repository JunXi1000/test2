package com.project.platform.controller;

import com.project.platform.entity.ProductCollect;
import com.project.platform.mapper.ProductCollectMapper;
import com.project.platform.service.ProductCollectService;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 商品收藏
 */
@RestController
@RequestMapping("/productCollect")
public class ProductCollectController {
    @Resource
    private ProductCollectService productCollectService;

    /**
     * 分页查询
     *
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    @GetMapping("page")
    public ResponseVO<PageVO<ProductCollect>> page(@RequestParam Map<String, Object> query, @RequestParam(defaultValue = "1") Integer pageNum, @RequestParam(defaultValue = "10") Integer pageSize) {
        PageVO<ProductCollect> page = productCollectService.page(query, pageNum, pageSize);
        return ResponseVO.ok(page);

    }

    /**
     * 根据id查询
     *
     * @param id
     * @return
     */
    @GetMapping("selectById/{id}")
    public ResponseVO<ProductCollect> selectById(@PathVariable("id") Integer id) {
        ProductCollect entity = productCollectService.selectById(id);
        return ResponseVO.ok(entity);
    }


    /**
     * 列表
     *
     * @return
     */
    @GetMapping("list")
    public ResponseVO<List<ProductCollect>> list() {
        return ResponseVO.ok(productCollectService.list());
    }


    /**
     * 新增
     *
     * @param entity
     * @return
     */
    @PostMapping("add")
    public ResponseVO<ProductCollect> add(@RequestBody ProductCollect entity) {
        productCollectService.insert(entity);
        return ResponseVO.ok(entity);
    }

    /**
     * 更新
     *
     * @param entity
     * @return
     */
    @PutMapping("update")
    public ResponseVO update(@RequestBody ProductCollect entity) {
        productCollectService.updateById(entity);
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
        productCollectService.removeByIds(ids);
        return ResponseVO.ok();
    }
}
