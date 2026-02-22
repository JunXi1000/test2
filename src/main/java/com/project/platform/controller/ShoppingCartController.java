package com.project.platform.controller;

import com.project.platform.dto.CreateOrderByShoppingCartDTO;
import com.project.platform.entity.ShoppingCart;
import com.project.platform.service.ShoppingCartService;
import com.project.platform.vo.PageVO;
import com.project.platform.vo.ResponseVO;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 购物车
 */
@RestController
@RequestMapping("/shoppingCart")
public class ShoppingCartController {
    @Resource
    private ShoppingCartService shoppingCartService;

    /**
     * 分页查询
     *
     * @param query
     * @param pageNum
     * @param pageSize
     * @return
     */
    @GetMapping("page")
    public ResponseVO<PageVO<ShoppingCart>> page(@RequestParam Map<String, Object> query, @RequestParam(defaultValue = "1") Integer pageNum, @RequestParam(defaultValue = "10") Integer pageSize) {
        PageVO<ShoppingCart> page = shoppingCartService.page(query, pageNum, pageSize);
        return ResponseVO.ok(page);

    }

    /**
     * 根据id查询
     *
     * @param id
     * @return
     */
    @GetMapping("selectById/{id}")
    public ResponseVO<ShoppingCart> selectById(@PathVariable("id") Integer id) {
        ShoppingCart entity = shoppingCartService.selectById(id);
        return ResponseVO.ok(entity);
    }


    /**
     * 列表
     *
     * @return
     */
    @GetMapping("list")
    public ResponseVO<List<ShoppingCart>> list() {
        return ResponseVO.ok(shoppingCartService.list());
    }


    /**
     * 新增
     *
     * @param entity
     * @return
     */
    @PostMapping("add")
    public ResponseVO add(@RequestBody ShoppingCart entity) {
        shoppingCartService.insert(entity);
        return ResponseVO.ok();
    }

    /**
     * 更新
     *
     * @param entity
     * @return
     */
    @PutMapping("update")
    public ResponseVO update(@RequestBody ShoppingCart entity) {
        shoppingCartService.updateById(entity);
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
        shoppingCartService.removeByIds(ids);
        return ResponseVO.ok();
    }



    @PostMapping("createOrder")
    public ResponseVO createOrder(@RequestBody CreateOrderByShoppingCartDTO createOrderByShoppingCartDTO) {
        shoppingCartService.createOrder(createOrderByShoppingCartDTO);
        return ResponseVO.ok();


    }
}
