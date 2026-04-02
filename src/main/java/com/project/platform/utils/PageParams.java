package com.project.platform.utils;

/**
 * 统一分页参数边界，避免 pageSize 过大拖垮数据库。
 */
public final class PageParams {

    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 100;

    private PageParams() {
    }

    public record Normalized(int pageNum, int pageSize, int offset) {
    }

    /**
     * @return 规范化后的页码、每页条数，以及 SQL offset（从 0 开始）
     */
    public static Normalized normalize(Integer pageNum, Integer pageSize) {
        int pn = (pageNum == null || pageNum < 1) ? 1 : pageNum;
        int ps = (pageSize == null || pageSize < 1) ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
        return new Normalized(pn, ps, (pn - 1) * ps);
    }
}
