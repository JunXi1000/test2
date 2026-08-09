package com.project.platform.service;

import com.project.platform.entity.ReturnRequest;

import java.util.List;

/**
 * 退换货申请服务
 */
public interface ReturnRequestService {

    List<ReturnRequest> getByUserId(Integer userId);

    ReturnRequest create(ReturnRequest request);
}
