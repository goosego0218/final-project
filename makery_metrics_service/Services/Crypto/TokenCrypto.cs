using System;
using System.Security.Cryptography;
using System.Text;

namespace makery_metrics_service.Services.Crypto;

/// <summary>
/// backend(app.utils.encryption)의 AES-256-GCM 토큰 암호화와 호환되는
/// 토큰 복호화 유틸리티입니다.
/// - Python 쪽 encrypt_token / decrypt_token 과 동일한 키 파생(PBKDF2) 방식과
///   암호화 포맷(IV 12byte + cipher + tag 16byte, Base64 URL-safe)을 사용합니다.
/// - 여기서는 메트릭 수집용으로 복호화 기능만 제공합니다.
/// </summary>
public static class TokenCrypto
{
    private const string SaltString = "makery_encryption_salt"; // backend와 동일
    private const int Iterations = 100_000;
    private const int KeySizeBytes = 32; // 256-bit
    private const int IvSizeBytes = 12;  // GCM 권장 IV 크기
    private const int TagSizeBytes = 16; // GCM 태그 크기

    /// <summary>
    /// backend의 encrypt_token()으로 암호화된 토큰을 복호화합니다.
    /// </summary>
    /// <param name="encryptedToken">Base64 URL-safe 문자열 (IV + cipher + tag)</param>
    /// <param name="secret">
    /// Python settings.encryption_key 에 해당하는 값.
    /// (이 서비스에서는 appsettings.json 의 Crypto:TokenDecryptKey 사용 예정)
    /// </param>
    /// <returns>복호화된 평문 토큰 (실패 시 원본 문자열 그대로 반환)</returns>
    public static string DecryptToken(string encryptedToken, string secret)
    {
        if (string.IsNullOrWhiteSpace(encryptedToken))
            return encryptedToken;

        if (string.IsNullOrWhiteSpace(secret))
            throw new ArgumentException("TokenDecryptKey 가 비어 있습니다.", nameof(secret));

        try
        {
            var key = DeriveKeyFromSecret(secret);

            // Base64 URL-safe 디코딩
            var encryptedData = Base64UrlDecode(encryptedToken);

            if (encryptedData.Length < IvSizeBytes + TagSizeBytes)
                throw new InvalidOperationException("암호화된 데이터가 너무 짧습니다.");

            // IV (nonce)
            var iv = new byte[IvSizeBytes];
            Buffer.BlockCopy(encryptedData, 0, iv, 0, IvSizeBytes);

            // cipher + tag 분리
            var cipherLength = encryptedData.Length - IvSizeBytes - TagSizeBytes;
            if (cipherLength <= 0)
                throw new InvalidOperationException("암호문 길이가 유효하지 않습니다.");

            var cipher = new byte[cipherLength];
            var tag = new byte[TagSizeBytes];

            Buffer.BlockCopy(encryptedData, IvSizeBytes, cipher, 0, cipherLength);
            Buffer.BlockCopy(encryptedData, IvSizeBytes + cipherLength, tag, 0, TagSizeBytes);

            var plaintext = new byte[cipher.Length];

            using var aesGcm = new AesGcm(key);
            aesGcm.Decrypt(iv, cipher, tag, plaintext);

            return Encoding.UTF8.GetString(plaintext);
        }
        catch
        {
            // backend decrypt_token 도 실패 시 원본을 그대로 반환하므로 동일하게 맞춤
            return encryptedToken;
        }
    }

    private static byte[] DeriveKeyFromSecret(string secret)
    {
        using var kdf = new Rfc2898DeriveBytes(
            password: Encoding.UTF8.GetBytes(secret),
            salt: Encoding.UTF8.GetBytes(SaltString),
            iterations: Iterations,
            HashAlgorithmName.SHA256
        );

        return kdf.GetBytes(KeySizeBytes);
    }

    private static byte[] Base64UrlDecode(string input)
    {
        // Python의 urlsafe_b64decode와 호환되도록 패딩 및 문자 치환
        var s = input.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2:
                s += "==";
                break;
            case 3:
                s += "=";
                break;
        }

        return Convert.FromBase64String(s);
    }
}


