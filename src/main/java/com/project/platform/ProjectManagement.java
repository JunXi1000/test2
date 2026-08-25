package com.project.platform;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan(basePackages = {"com.project.platform.mapper"})
@EnableScheduling
public class ProjectManagement {
    public static void main(String[] args) {
        SpringApplication.run(ProjectManagement.class, args);
    }
}

