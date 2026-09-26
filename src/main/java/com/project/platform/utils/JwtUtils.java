package com.project.platform.utils;

import com.alibaba.fastjson2.JSON;
import com.project.platform.dto.CurrentUserDTO;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import lombok.extern.slf4j.Slf4j;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 生成jwt
 */
@Slf4j
public class JwtUtils {

    /**
     * token 过期时间(毫秒):24 小时。
     */
    private static final long TOKEN_EXPIRED_TIME = 24L * 60 * 60 * 1000;

    /**
     * jwt 签名密钥。来源优先级:{@code -Djwt.secret}(测试) → {@code JWT_SECRET} 环境变量
     * → **一次性随机密钥**(仅非生产 profile)。
     *
     * <p><b>仓库里不放任何可用密钥。</b>开发便利用"随机生成一次性密钥"实现,而不是写一个固定兜底值:
     * 固定值一旦进仓库就等于公开,而**用 profile 字符串当唯一屏障是 fail-open 的**
     * (生产部署忘了设 {@code SPRING_PROFILES_ACTIVE=prod} 就会用上那把公开密钥)。
     * 随机密钥没有这个问题 —— 它只存在于本进程内存里。
     *
     * <p>代价:dev 重启后旧 token 失效(前端会按 401 跳登录,属预期)。生产必须注入 {@code JWT_SECRET}。
     */
    private static final String JWT_SECRET = resolveSecret();

    private static String resolveSecret() {
        String fromSystem = System.getProperty("jwt.secret");
        if (fromSystem != null && !fromSystem.isBlank()) {
            return fromSystem;
        }
        String fromEnv = System.getenv("JWT_SECRET");
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv;
        }
        if (isProductionProfile()) {
            throw new IllegalStateException(
                    "生产环境必须提供 JWT_SECRET(或 -Djwt.secret=...):本应用不会为生产生成临时密钥,"
                            + "因为那样每次重启都会让所有 token 失效,且无从与其它实例共享会话。");
        }
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        log.warn("未提供 JWT_SECRET,已生成本次运行的临时开发密钥(重启后旧 token 失效);生产请注入 JWT_SECRET。");
        return Base64.getEncoder().encodeToString(random);
    }

    /** 当前是否生产 profile —— 只作为**辅助**提示,真正的屏障是"仓库里没有可用密钥" */
    private static boolean isProductionProfile() {
        String profiles = System.getProperty("spring.profiles.active");
        if (profiles == null || profiles.isBlank()) {
            profiles = System.getenv("SPRING_PROFILES_ACTIVE");
        }
        return profiles != null && profiles.toLowerCase().contains("prod");
    }

    /**
     * 创建JWT
     */
    public static String createJWT(Map<String, Object> claims, Long time) {
        SignatureAlgorithm signatureAlgorithm = SignatureAlgorithm.HS256; //指定签名的时候使用的签名算法，也就是header那部分，jjwt已经将这部分内容封装好了。
        Date now = new Date(System.currentTimeMillis());

        SecretKey secretKey = generalKey();
        long nowMillis = System.currentTimeMillis();//生成JWT的时间
        //下面就是在为payload添加各种标准声明和私有声明了
        JwtBuilder builder = Jwts.builder() //这里其实就是new一个JwtBuilder，设置jwt的body
                .setClaims(claims)          //如果有私有声明，一定要先设置这个自己创建的私有的声明，这个是给builder的claim赋值，一旦写在标准的声明赋值之后，就是覆盖了那些标准的声明的
                .setId(UUID.randomUUID().toString())   //设置jti(JWT ID)：每次签发唯一,防止重放攻击。
                .setIssuedAt(now)           //iat: jwt的签发时间
                .signWith(signatureAlgorithm, secretKey);//设置签名使用的签名算法和签名使用的秘钥
        if (time >= 0) {
            long expMillis = nowMillis + time;
            Date exp = new Date(expMillis);
            builder.setExpiration(exp);     //设置过期时间
        }
        return builder.compact();
    }


    /**
     * 验证jwt。
     *
     * <p>过期与无效都返回 {@code null}(对调用方语义相同:token 不可用)。但**日志要能区分** ——
     * 此前一律 {@code catch (Exception)} 吞掉,导致「用户 token 过期」和「有人拿伪造 token 试探」
     * 在日志里长得一样,排障时无法分辨。只记异常消息,不记 token 内容。
     */
    public static Claims verifyJwt(String token) {
        //签名秘钥，和生成的签名的秘钥一模一样
        SecretKey key = generalKey();
        try {
            return Jwts.parser()  //得到DefaultJwtParser
                    .setSigningKey(key)         //设置签名的秘钥
                    .parseClaimsJws(token).getBody();
        } catch (ExpiredJwtException e) {
            log.info("token 已过期(需重新登录)");
            return null;
        } catch (Exception e) {
            log.warn("token 校验失败({})", e.getClass().getSimpleName());
            return null;
        }
    }

    /**
     * 由字符串生成加密key
     *
     * @return
     */
    public static SecretKey generalKey() {
        byte[] encodedKey = Base64.getEncoder().encode(JWT_SECRET.getBytes());
        SecretKey key = new SecretKeySpec(encodedKey, 0, encodedKey.length, "AES");
        return key;
    }

    /**
     * 根据userId和openid生成token
     * 传入User实体类
     */
    public static String generateToken(CurrentUserDTO currentUserDTO) {
        Map<String, Object> map = new HashMap<>();
        map.put("currentUser", JSON.toJSONString(currentUserDTO));
        return createJWT(map, TOKEN_EXPIRED_TIME);
    }
}
