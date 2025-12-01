import os
from time import sleep

from dotenv import load_dotenv
from pyngrok import ngrok


def main() -> None:
    """
    - .env 에서 NGROK_AUTHTOKEN 읽어서 인증
    - 지정한 포트(기본 8000)에 ngrok http 터널 생성
    - public URL / TikTok callback URL 출력
    - Ctrl+C 전까지 터널 유지
    """
    # 1) .env 로딩
    load_dotenv()

    ngrok_token = "368p3KAqcrdDsr2Urjm4SHXiLgR_4aZ7jStYtaMnf3RmU8mKh"


    # 2) ngrok 인증 설정
    ngrok.set_auth_token(ngrok_token)

    # 3) 터널을 열 포트 (기본 8000, 필요하면 .env 에 APP_PORT 추가해서 사용)
    port_str = os.getenv("APP_PORT", "8000")
    try:
        port = int(port_str)
    except ValueError:
        raise RuntimeError(f"APP_PORT 값이 잘못되었습니다: {port_str!r}")

    # 4) ngrok 터널 생성 (https 형태 URL)
    tunnel = ngrok.connect(port, proto="http", bind_tls=True)
    public_url = tunnel.public_url

    # 5) TikTok 콜백 URL 안내용 출력
    callback_path = "/social/tiktok/callback"
    callback_url = public_url.rstrip("/") + callback_path

    print("\n==============================================")
    print(f"[ngrok] public URL: {public_url}")
    print(f"[ngrok] TikTok Redirect URI (callback):")
    print(f"        {callback_url}")
    print("==============================================")
    print("TikTok 개발자 콘솔 Redirect URL 과 .env 의")
    print("TIKTOK_REDIRECT_URI 를 위 callback URL 과 같게 맞추세요.")
    print("\nCtrl+C 를 누르면 ngrok 터널이 종료됩니다.\n")

    # 6) 프로세스를 유지해서 터널이 살아있도록 함
    try:
        while True:
            sleep(1)
    except KeyboardInterrupt:
        print("\n[ngrok] 터널 종료 중...")
        try:
            ngrok.disconnect(public_url)
        except Exception:
            pass
        try:
            ngrok.kill()
        except Exception:
            pass
        print("[ngrok] 종료 완료")


if __name__ == "__main__":
    main()
