package com.project.platform.service.impl;

import cn.hutool.core.net.url.UrlBuilder;
import com.project.platform.exception.CustomException;
import com.project.platform.service.FileService;
import com.project.platform.vo.FileInfoVO;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Set;

@Service
public class FileServiceImpl implements FileService {

    /**
     * 上传文件扩展名白名单,仅允许以下类型(防上传可执行脚本/混淆扩展名文件)
     */
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp", "bmp",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "txt", "mp4", "mp3", "zip"
    );

    /**
     * 上传大小上限 10MB,与 spring.servlet.multipart.max-file-size 对齐
     */
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

    @Value("${server.ip}")
    private String serverIp;
    @Value("${server.port}")
    private int serverPort;
    @Value("${files.uploads.path}")
    private String basePath;

    @Value("${files.uploads.baseUrl:}")
    private String fileBaseUrl;


    public FileInfoVO upload(MultipartFile multipartFile) throws IOException, NoSuchAlgorithmException {
        // 上传大小防御性校验(与 multipart.max-file-size 双保险, 前者超限抛 500, 这里给干净的 400)
        if (multipartFile.isEmpty()) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "上传文件不能为空");
        }
        if (multipartFile.getSize() > MAX_FILE_SIZE) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "文件大小不能超过 10MB");
        }
        //获取上传文件扩展名
        String fix = FilenameUtils.getExtension(multipartFile.getOriginalFilename());
        //生成文件完整名称
        if (StringUtils.isBlank(fix)) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "文件扩展名不能为空");
        }
        fix = fix.toLowerCase();
        // 扩展名白名单校验
        if (!ALLOWED_EXTENSIONS.contains(fix)) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "不支持的文件类型: " + fix);
        }
        //生成文件名 使用MD5 虽然可能产生哈希碰撞 但是一般的场景足够使用
        String md5 = getMD5Checksum(multipartFile);
        String newFileName = md5 + "." + fix;
        File newFile = createFile(newFileName);
        // 直接转移文件到指定路径
        multipartFile.transferTo(new File(newFile.getAbsolutePath()));
        FileInfoVO fileInfoVO = new FileInfoVO();
        fileInfoVO.setUrl(getServer() + "/" + newFileName);
        fileInfoVO.setName(newFileName);
        return fileInfoVO;
    }


    private File createFile(String fileName) throws IOException {
        File file = new File(Paths.get(basePath, fileName).toString());
        if (file.exists()) {
            return file;
        }
        // 判断配置的文件目录是否存在，若不存在则创建一个新的文件目录
        File parentFile = file.getParentFile();
        if (!parentFile.exists()) {
            parentFile.mkdirs();
        }
        return file;
    }


    private String getServer() {
        if (StringUtils.isNotEmpty(fileBaseUrl)) {
            return fileBaseUrl;
        }
        String buildUrl = UrlBuilder.create()
                .setScheme("http")
                .setHost(serverIp)
                .setPort(serverPort)
                .addPath("file")
                .build();
        return buildUrl;
    }


    public File getFile(String fileName) throws IOException {
        // 防路径穿越: 归一化(去 ../ 与 .)后必须仍位于 basePath 目录内, 拒绝 ../ 与绝对路径逃逸
        Path base = Paths.get(basePath).toAbsolutePath().normalize();
        Path resolved = base.resolve(fileName).normalize();
        if (!resolved.startsWith(base)) {
            throw new CustomException(HttpStatus.BAD_REQUEST, "非法文件路径");
        }
        return resolved.toFile();
    }

    /**
     * 计算文件的MD5
     *
     * @param file
     * @return
     * @throws NoSuchAlgorithmException
     * @throws IOException
     */
    private String getMD5Checksum(MultipartFile file) throws NoSuchAlgorithmException, IOException {
        MessageDigest md5Digest = MessageDigest.getInstance("MD5");
        byte[] fileBytes = file.getBytes();
        md5Digest.update(fileBytes);

        StringBuilder sb = new StringBuilder();
        for (byte b : md5Digest.digest()) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
