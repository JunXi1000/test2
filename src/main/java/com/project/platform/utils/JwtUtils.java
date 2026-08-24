package com.project.platform.utils;

import com.alibaba.fastjson2.JSON;
import com.project.platform.dto.CurrentUserDTO;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 生成jwt
 */
public class JwtUtils {

    /**
     * token 过期时间(毫秒):24 小时。
     */
    private static final long TOKEN_EXPIRED_TIME = 24L * 60 * 60 * 1000;

    /**
     * jwt 加密密钥,由环境变量 JWT_SECRET 注入(生产必配,勿用兜底值)。
     */
    private static final String JWT_SECRET = resolveSecret();

    private static String resolveSecret() {
        // 兼容 -Djwt.secret=xxx(测试/本地)与 JWT_SECRET 环境变量(生产)
        String fromSystem = System.getProperty("jwt.secret");
        if (fromSystem != null && !fromSystem.isBlank()) {
            return fromSystem;
        }
        String fromEnv = System.getenv("JWT_SECRET");
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv;
        }
        // 仅限本地开发/测试的兜底值,长度 44B >= HS256 要求的 32B;生产必须由环境变量注入
        return "dev-only-secret-2f8a1b9c3d4e5f6a7b8c9d0e1f2a3b4c";
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
     * 验证jwt
     */
    public static Claims verifyJwt(String token) {
        //签名秘钥，和生成的签名的秘钥一模一样
        SecretKey key = generalKey();
        Claims claims;
        try {
            claims = Jwts.parser()  //得到DefaultJwtParser
                    .setSigningKey(key)         //设置签名的秘钥
                    .parseClaimsJws(token).getBody();
        } catch (Exception e) {
            claims = null;
        }//设置需要解析的jwt
        return claims;

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
