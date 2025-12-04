using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

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
    /// 문자열이 유효한 Base64 URL-safe 형식인지 확인합니다.
    /// </summary>
    private static bool IsBase64Encoded(string s)
    {
        if (string.IsNullOrWhiteSpace(s))
            return false;

        // Base64 URL-safe 문자셋 확인 (A-Z, a-z, 0-9, -, _)
        var base64Pattern = new Regex(@"^[A-Za-z0-9_-]+=*$");
        if (!base64Pattern.IsMatch(s))
            return false;

        // 길이 검증 (패딩 제외 후 4의 배수 확인)
        var sClean = s.TrimEnd('=');
        if (sClean.Length % 4 == 1)
            return false;

        // 실제 디코딩 시도
        try
        {
            Base64UrlDecode(s);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// backend의 encrypt_token()으로 암호화된 토큰을 복호화합니다.
    /// 평문 토큰이 감지되면 그대로 반환합니다 (이미 평문이므로).
    /// </summary>
    /// <param name="encryptedToken">Base64 URL-safe 문자열 (IV + cipher + tag) 또는 평문 토큰</param>
    /// <param name="secret">
    /// Python settings.encryption_key 에 해당하는 값.
    /// (이 서비스에서는 appsettings.json 의 Crypto:TokenDecryptKey 사용 예정)
    /// </param>
    /// <returns>복호화된 평문 토큰 (평문 토큰이면 원본 그대로 반환)</returns>
    public static string DecryptToken(string encryptedToken, string secret)
    {
        if (string.IsNullOrWhiteSpace(encryptedToken))
            return encryptedToken;

        if (string.IsNullOrWhiteSpace(secret))
            throw new ArgumentException("TokenDecryptKey 가 비어 있습니다.", nameof(secret));

        // Base64 형식이 아니면 이미 평문으로 간주
        if (!IsBase64Encoded(encryptedToken))
            return encryptedToken;

        try
        {
            var key = DeriveKeyFromSecret(secret);

            // Base64 URL-safe 디코딩
            byte[] encryptedData;
            try
            {
                encryptedData = Base64UrlDecode(encryptedToken);
            }
            catch
            {
                // Base64 디코딩 실패 시 평문으로 간주
                return encryptedToken;
            }

            if (encryptedData.Length < IvSizeBytes + TagSizeBytes)
            {
                // 암호화된 데이터가 너무 짧으면 평문으로 간주
                return encryptedToken;
            }

            // IV (nonce)
            var iv = new byte[IvSizeBytes];
            Buffer.BlockCopy(encryptedData, 0, iv, 0, IvSizeBytes);

            // cipher + tag 분리
            var cipherLength = encryptedData.Length - IvSizeBytes - TagSizeBytes;
            if (cipherLength <= 0)
            {
                // 암호문 길이가 유효하지 않으면 평문으로 간주
                return encryptedToken;
            }

            var cipher = new byte[cipherLength];
            var tag = new byte[TagSizeBytes];

            Buffer.BlockCopy(encryptedData, IvSizeBytes, cipher, 0, cipherLength);
            Buffer.BlockCopy(encryptedData, IvSizeBytes + cipherLength, tag, 0, TagSizeBytes);

            var plaintext = new byte[cipher.Length];

            // 태그 길이를 명시하는 생성자 사용 (권장 방식)
            using var aesGcm = new AesGcm(key, TagSizeBytes);
            aesGcm.Decrypt(iv, cipher, tag, plaintext);

            return Encoding.UTF8.GetString(plaintext);
        }
        catch
        {
            // 복호화 실패 시 원본 반환 (이미 평문이거나 다른 형식일 수 있음)
            return encryptedToken;
        }
    }

    private static byte[] DeriveKeyFromSecret(string secret)
    {
        var password = Encoding.UTF8.GetBytes(secret);
        var salt = Encoding.UTF8.GetBytes(SaltString);

        // static Pbkdf2 메서드 사용 (이 환경에서는 위치 기반 인자로 호출)
        return Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            KeySizeBytes
        );
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


