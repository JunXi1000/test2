package com.project.platform.service.impl;

import com.project.platform.entity.ReturnRequest;
import com.project.platform.mapper.ReturnRequestMapper;
import com.project.platform.service.ReturnRequestService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 退换货申请服务
 */
@Service
public class ReturnRequestServiceImpl implements ReturnRequestService {

    @Resource
    private ReturnRequestMapper returnRequestMapper;

    @Override
    public List<ReturnRequest> getByUserId(Integer userId) {
        return returnRequestMapper.selectByUserId(userId);
    }

    @Override
    public ReturnRequest create(ReturnRequest request) {
        request.setStatus("pending");
        request.setUpdatedTime(LocalDateTime.now());
        returnRequestMapper.insert(request);
        // 回读 DB 默认时间字段
        return returnRequestMapper.selectById(request.getId());
    }
}
