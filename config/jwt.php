<?php
require_once __DIR__ . '/config.php';

class JWT {

    public static function encode(array $payload): string {
        $header  = self::base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload['iat'] = time();
        $payload['exp'] = time() + JWT_EXPIRE;
        $payload = self::base64url(json_encode($payload));
        $sig     = self::base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
        return "$header.$payload.$sig";
    }

    public static function decode(string $token): array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new Exception('Token invalide');
        }
        [$header, $payload, $sig] = $parts;

        $expected = self::base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
        if (!hash_equals($expected, $sig)) {
            throw new Exception('Signature invalide');
        }

        $data = json_decode(self::base64urlDecode($payload), true);
        if ($data['exp'] < time()) {
            throw new Exception('Token expiré');
        }
        return $data;
    }

    private static function base64url(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64urlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
