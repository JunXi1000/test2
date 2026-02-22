package com.project.platform.controller;

import com.project.platform.entity.Slideshow;
import com.project.platform.service.SlideshowService;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 轮播图
 */
@RestController
@RequestMapping("/slideshow")
public class SlideshowController {
    @Resource
    private SlideshowService slideshowService;

    /**
     * 分页查询
     *
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    @GetMapping("page")
    public ResponseVO<PageVO<Slideshow>> page(@RequestParam Map<String, Object> query, @RequestParam(defaultValue = "1") Integer pageNum, @RequestParam(defaultValue = "10") Integer pageSize) {
        PageVO<Slideshow> page = slideshowService.page(query, pageNum, pageSize);
        return ResponseVO.ok(page);

    }

    /**
     * 根据id查询
     *
     * @param id
     * @return
     */
    @GetMapping("selectById/{id}")
    public ResponseVO<Slideshow> selectById(@PathVariable("id") Integer id) {
        Slideshow entity = slideshowService.selectById(id);
        return ResponseVO.ok(entity);
    }


    /**
     * 列表
     *
     * @return
     */
    @GetMapping("list")
    public ResponseVO<List<Slideshow>> list() {
        return ResponseVO.ok(slideshowService.list());
    }


    /**
     * 新增
     *
     * @param entity
     * @return
     */
    @PostMapping("add")
    public ResponseVO add(@RequestBody Slideshow entity) {
        slideshowService.insert(entity);
        return ResponseVO.ok();
    }

    /**
     * 更新
     *
     * @param entity
     * @return
     */
    @PutMapping("update")
    public ResponseVO update(@RequestBody Slideshow entity) {
        slideshowService.updateById(entity);
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
        slideshowService.removeByIds(ids);
        return ResponseVO.ok();
    }
}
