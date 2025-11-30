------------------------------------------------------------------------------------------------------------------------
-- user_info 테이블
CREATE TABLE user_info (
    id            NUMBER NOT NULL,                  -- 유저번호
    login_id      VARCHAR2(255) NOT NULL,           -- 아이디
    password_hash VARCHAR2(255) NOT NULL,           -- 비밀번호
    nickname      VARCHAR2(255) NOT NULL,           -- 닉네임
    status        CHAR(1) DEFAULT 'Y' NOT NULL,     -- 상태
    create_dt     DATE DEFAULT SYSDATE NOT NULL,    -- 생성일
    update_dt     DATE DEFAULT SYSDATE NOT NULL,    -- 수정일
    role_id       NUMBER NOT NULL,                  -- 권한
    CONSTRAINT PK_USER_INFO PRIMARY KEY (id)
);

CREATE SEQUENCE seq_user_info
    START WITH 1
    INCREMENT BY 1
    NOCACHE;

CREATE OR REPLACE TRIGGER trg_user_info_id
BEFORE INSERT ON user_info
FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        :NEW.id := seq_user_info.NEXTVAL;
    END IF;
END;

CREATE OR REPLACE TRIGGER trg_user_info_update_dt
BEFORE UPDATE ON user_info
FOR EACH ROW
BEGIN
    :NEW.update_dt := SYSDATE;
END;

COMMENT ON COLUMN user_info.id            IS '유저번호';
COMMENT ON COLUMN user_info.login_id      IS '아이디';
COMMENT ON COLUMN user_info.password_hash IS '비밀번호';
COMMENT ON COLUMN user_info.nickname      IS '닉네임';
COMMENT ON COLUMN user_info.status        IS '상태';
COMMENT ON COLUMN user_info.create_dt     IS '생성일';
COMMENT ON COLUMN user_info.update_dt     IS '수정일';
COMMENT ON COLUMN user_info.role_id       IS '권한';

------------------------------------------------------------------------------------------------------------------------
-- role_mst 테이블
CREATE TABLE ROLE_MST (
    ROLE_ID   NUMBER NOT NULL,                 -- 권한ID
    ROLE_NM   VARCHAR2(255) NOT NULL,          -- 권한명
    DEL_YN    CHAR(1) DEFAULT 'N' NOT NULL     -- 삭제여부 (Y/N)
);

ALTER TABLE ROLE_MST 
    ADD CONSTRAINT PK_ROLE PRIMARY KEY (ROLE_ID);

COMMENT ON COLUMN ROLE_MST.ROLE_ID IS '권한ID';
COMMENT ON COLUMN ROLE_MST.ROLE_NM IS '권한명';
COMMENT ON COLUMN ROLE_MST.DEL_YN IS '삭제여부';

ALTER TABLE USER_INFO
    ADD CONSTRAINT FK_USER_INFO_ROLE
        FOREIGN KEY (ROLE_ID)
        REFERENCES ROLE_MST (ROLE_ID);

INSERT INTO ROLE_MST (ROLE_ID, ROLE_NM, DEL_YN) VALUES (0, 'SYSTEM', 'N');
INSERT INTO ROLE_MST (ROLE_ID, ROLE_NM, DEL_YN) VALUES (1, 'ADMIN',  'N');
INSERT INTO ROLE_MST (ROLE_ID, ROLE_NM, DEL_YN) VALUES (2, 'GENERAL','N');
INSERT INTO ROLE_MST (ROLE_ID, ROLE_NM, DEL_YN) VALUES (3, 'ALL',    'N');

------------------------------------------------------------------------------------------------------------------------
-- menu 테이블
CREATE TABLE menu (
    menu_id     NUMBER          NOT NULL,                  -- 메뉴ID
    menu_nm     VARCHAR2(255)   NOT NULL,                  -- 메뉴명
    up_menu_id  NUMBER          NULL,                      -- 상위 메뉴
    menu_path   VARCHAR2(255)   NOT NULL,                  -- 메뉴 경로
    del_yn      CHAR(1) DEFAULT 'N' NOT NULL,             -- 삭제여부
    menu_order  NUMBER          NULL                       -- 메뉴 정렬 순서
);

ALTER TABLE menu 
    ADD CONSTRAINT pk_menu PRIMARY KEY (menu_id);

CREATE SEQUENCE seq_menu_id
    START WITH 1
    INCREMENT BY 1
    NOCACHE;

CREATE OR REPLACE TRIGGER trg_menu_bi
BEFORE INSERT ON menu
FOR EACH ROW
BEGIN
    IF :NEW.menu_id IS NULL THEN
        SELECT seq_menu_id.NEXTVAL
          INTO :NEW.menu_id
          FROM dual;
    END IF;
END;

INSERT INTO menu (menu_nm, up_menu_id, menu_path, del_yn, menu_order)
VALUES ('Home',           NULL, '/',                'N', 1);

INSERT INTO menu (menu_nm, up_menu_id, menu_path, del_yn, menu_order)
VALUES ('로고 갤러리',    NULL, '/logo-gallery',    'N', 2);

INSERT INTO menu (menu_nm, up_menu_id, menu_path, del_yn, menu_order)
VALUES ('숏폼 갤러리',    NULL, '/shortform-gallery','N', 3);

INSERT INTO menu (menu_nm, up_menu_id, menu_path, del_yn, menu_order)
VALUES ('내 프로젝트',    NULL, '/projects',        'N', 4);

INSERT INTO menu (menu_nm, up_menu_id, menu_path, del_yn, menu_order)
VALUES ('숏폼 리포트',    NULL, '/shortsReport',    'N', 5);

INSERT INTO menu (menu_nm, up_menu_id, menu_path, del_yn, menu_order)
VALUES ('플랜 관리',      NULL, '/plans',           'N', 6);

------------------------------------------------------------------------------------------------------------------------
-- role_menu 테이블
CREATE TABLE role_menu (
    role_id NUMBER NOT NULL,   -- 권한ID (FK → role_mst.role_id)
    menu_id NUMBER NOT NULL    -- 메뉴ID (FK → menu.menu_id)
);

ALTER TABLE role_menu
    ADD CONSTRAINT pk_role_menu
        PRIMARY KEY (role_id, menu_id);

ALTER TABLE role_menu
    ADD CONSTRAINT fk_role_menu_role
        FOREIGN KEY (role_id)
        REFERENCES role_mst (role_id);

ALTER TABLE role_menu
    ADD CONSTRAINT fk_role_menu_menu
        FOREIGN KEY (menu_id)
        REFERENCES menu (menu_id);

-- role 0: 메뉴 1~6 전부
INSERT INTO role_menu (role_id, menu_id) VALUES (0, 1);
INSERT INTO role_menu (role_id, menu_id) VALUES (0, 2);
INSERT INTO role_menu (role_id, menu_id) VALUES (0, 3);
INSERT INTO role_menu (role_id, menu_id) VALUES (0, 4);
INSERT INTO role_menu (role_id, menu_id) VALUES (0, 5);
INSERT INTO role_menu (role_id, menu_id) VALUES (0, 6);

-- role 1: 메뉴 1~6 전부
INSERT INTO role_menu (role_id, menu_id) VALUES (1, 1);
INSERT INTO role_menu (role_id, menu_id) VALUES (1, 2);
INSERT INTO role_menu (role_id, menu_id) VALUES (1, 3);
INSERT INTO role_menu (role_id, menu_id) VALUES (1, 4);
INSERT INTO role_menu (role_id, menu_id) VALUES (1, 5);
INSERT INTO role_menu (role_id, menu_id) VALUES (1, 6);

-- role 2: 메뉴 1~6 전부
INSERT INTO role_menu (role_id, menu_id) VALUES (2, 1);
INSERT INTO role_menu (role_id, menu_id) VALUES (2, 2);
INSERT INTO role_menu (role_id, menu_id) VALUES (2, 3);
INSERT INTO role_menu (role_id, menu_id) VALUES (2, 4);
INSERT INTO role_menu (role_id, menu_id) VALUES (2, 5);
INSERT INTO role_menu (role_id, menu_id) VALUES (2, 6);

-- role 3: 비로그인 유저 → 4번(내 프로젝트), 6번(숏폼 리포트) 제외
INSERT INTO role_menu (role_id, menu_id) VALUES (3, 1);
INSERT INTO role_menu (role_id, menu_id) VALUES (3, 2);
INSERT INTO role_menu (role_id, menu_id) VALUES (3, 3);
INSERT INTO role_menu (role_id, menu_id) VALUES (3, 5);

------------------------------------------------------------------------------------------------------------------------
-- prod_grp 테이블 (프로젝트/그룹)
CREATE TABLE prod_grp (
    grp_id        NUMBER          NOT NULL,                   -- 그룹번호
    grp_nm        VARCHAR2(255)   NOT NULL,                   -- 그룹명
    grp_desc      VARCHAR2(1000)  NULL,                       -- 그룹설명
    creator_id    NUMBER          NOT NULL,                   -- 생성자 (user_info.id)
    updater_id    NUMBER          NULL,                       -- 수정자 (user_info.id)
    create_dt     DATE DEFAULT SYSDATE NOT NULL,             -- 생성일
    update_dt     DATE DEFAULT SYSDATE NOT NULL,             -- 수정일
    del_yn        CHAR(1) DEFAULT 'N' NOT NULL,              -- 삭제여부
    CONSTRAINT PK_PROD_GRP PRIMARY KEY (grp_id)
);

CREATE SEQUENCE SEQ_PROD_GRP
    START WITH 1
    INCREMENT BY 1
    NOCACHE;

CREATE OR REPLACE TRIGGER TRG_PROD_GRP_ID
BEFORE INSERT ON prod_grp
FOR EACH ROW
BEGIN
    IF :NEW.grp_id IS NULL THEN
        SELECT SEQ_PROD_GRP.NEXTVAL INTO :NEW.grp_id FROM dual;
    END IF;
END;

CREATE OR REPLACE TRIGGER TRG_PROD_GRP_BU
BEFORE UPDATE ON prod_grp
FOR EACH ROW
BEGIN
    :NEW.update_dt := SYSDATE;
END;

ALTER TABLE prod_grp
    ADD CONSTRAINT FK_PROD_USER
        FOREIGN KEY (creator_id) REFERENCES user_info(id);

ALTER TABLE prod_grp
    ADD CONSTRAINT FK_PROD_UPD_USER
        FOREIGN KEY (updater_id) REFERENCES user_info(id);

------------------------------------------------------------------------------------------------------------------------
-- prod_type 테이블
CREATE TABLE prod_type (
    type_id    NUMBER         NOT NULL,             -- 타입번호
    type_nm    VARCHAR2(255)  NULL,                -- 타입명
    del_yn     CHAR(1) DEFAULT 'N' NOT NULL,       -- 삭제여부
    CONSTRAINT PK_PROD_TYPE PRIMARY KEY (type_id)
);

INSERT INTO PROD_TYPE (TYPE_ID, TYPE_NM, DEL_YN) VALUES (1, '로고',  'N');
INSERT INTO PROD_TYPE (TYPE_ID, TYPE_NM, DEL_YN) VALUES (2, '숏폼',  'N');

------------------------------------------------------------------------------------------------------------------------
-- brand_info 테이블
CREATE TABLE brand_info (
    grp_id           NUMBER           NOT NULL,                    -- 프로젝트/브랜드 번호 (FK)
    brand_name       VARCHAR2(255)    NOT NULL,                    -- 브랜드명
    category         VARCHAR2(255)    NOT NULL,                    -- 업종 카테고리
    tone_mood        VARCHAR2(255)    NULL,                        -- 브랜드 톤/무드
    core_keywords    VARCHAR2(1000)   NULL,                        -- 핵심 키워드
    slogan           VARCHAR2(500)    NULL,                        -- 슬로건
    target_age       VARCHAR2(100)    NULL,                        -- 타깃 연령대
    target_gender    VARCHAR2(50)     NULL,                        -- 타깃 성별
    avoided_trends   VARCHAR2(1000)   NULL,                        -- 기피 트렌드/분위기
    preferred_colors VARCHAR2(500)    NULL,                        -- 선호 색상/색감
    create_dt        DATE DEFAULT SYSDATE NOT NULL,               -- 생성일
    update_dt        DATE DEFAULT SYSDATE NOT NULL,               -- 수정일
    CONSTRAINT PK_BRAND_INFO PRIMARY KEY (grp_id)
);

COMMENT ON COLUMN brand_info.grp_id           IS '그룹번호';
COMMENT ON COLUMN brand_info.brand_name       IS '브랜드명';
COMMENT ON COLUMN brand_info.category         IS '업종';
COMMENT ON COLUMN brand_info.tone_mood        IS '브랜드톤';
COMMENT ON COLUMN brand_info.core_keywords    IS '핵심키워드';
COMMENT ON COLUMN brand_info.slogan           IS '슬로건';
COMMENT ON COLUMN brand_info.target_age       IS '타깃연령대';
COMMENT ON COLUMN brand_info.target_gender    IS '타깃성별';
COMMENT ON COLUMN brand_info.avoided_trends   IS '기피트렌드';
COMMENT ON COLUMN brand_info.preferred_colors IS '선호색상';
COMMENT ON COLUMN brand_info.create_dt        IS '생성일';
COMMENT ON COLUMN brand_info.update_dt        IS '수정일';

ALTER TABLE brand_info
  ADD CONSTRAINT FK_BRAND_INFO_GRP
  FOREIGN KEY (grp_id)
  REFERENCES prod_grp (grp_id);

CREATE OR REPLACE TRIGGER TRG_BRAND_INFO_BU
BEFORE UPDATE ON brand_info
FOR EACH ROW
BEGIN
    :NEW.update_dt := SYSDATE;
END;

------------------------------------------------------------------------------------------------------------------------
-- generation_prod 테이블
CREATE TABLE GENERATION_PROD (
    PROD_ID      NUMBER         NOT NULL,                   -- 결과물 번호 (PK)
    TYPE_ID      NUMBER         NOT NULL,                   -- 타입번호  -> PROD_TYPE.TYPE_ID
    GRP_ID       NUMBER         NOT NULL,                   -- 그룹번호  -> PROD_GRP.GRP_ID
    FILE_PATH    VARCHAR2(1000) NOT NULL,                   -- 파일경로
    VIEW_CNT     NUMBER         DEFAULT 0 NOT NULL,         -- 조회수
    REF_CNT      NUMBER         DEFAULT 0 NOT NULL,         -- 참조수
    LIKE_CNT     NUMBER         DEFAULT 0 NOT NULL,         -- 좋아요수
    PUB_YN       CHAR(1)        DEFAULT 'N' NOT NULL,       -- 공개여부 (Y/N)
    CREATE_USER  NUMBER         NOT NULL,                   -- 생성자 -> USER_INFO.ID
    CREATE_DT    DATE           DEFAULT SYSDATE NOT NULL,   -- 생성일
    UPDATE_USER  NUMBER         NULL,                       -- 수정자 -> USER_INFO.ID
    UPDATE_DT    DATE           DEFAULT SYSDATE NOT NULL,   -- 수정일
    DEL_YN       CHAR(1)        DEFAULT 'N' NOT NULL,       -- 삭제여부 (Y/N)
    CONSTRAINT PK_GENERATION_PROD PRIMARY KEY (PROD_ID),
    CONSTRAINT FK_GEN_PROD_TYPE
        FOREIGN KEY (TYPE_ID) REFERENCES PROD_TYPE (TYPE_ID),
    CONSTRAINT FK_GEN_PROD_GRP
        FOREIGN KEY (GRP_ID) REFERENCES PROD_GRP (GRP_ID),
    CONSTRAINT FK_GEN_PROD_CRT_USER
        FOREIGN KEY (CREATE_USER) REFERENCES USER_INFO (ID),
    CONSTRAINT FK_GEN_PROD_UPD_USER
        FOREIGN KEY (UPDATE_USER) REFERENCES USER_INFO (ID)
);

CREATE SEQUENCE SEQ_GENERATION_PROD
    START WITH 1
    INCREMENT BY 1
    NOCACHE;

CREATE OR REPLACE TRIGGER TRG_GENERATION_PROD_BI
BEFORE INSERT ON GENERATION_PROD
FOR EACH ROW
BEGIN
    IF :NEW.PROD_ID IS NULL THEN
        :NEW.PROD_ID := SEQ_GENERATION_PROD.NEXTVAL;
    END IF;
END;

CREATE OR REPLACE TRIGGER TRG_GENERATION_PROD_BU
BEFORE UPDATE ON GENERATION_PROD
FOR EACH ROW
BEGIN
    :NEW.UPDATE_DT := SYSDATE;
END;

------------------------------------------------------------------------------------------------------------------------
-- social_connection 테이블
CREATE TABLE social_connection (
    conn_id           NUMBER           NOT NULL,               -- 연동ID (PK)
    user_id           NUMBER           NOT NULL,               -- 유저번호 (FK → user_info.id)
    platform          VARCHAR2(50)     NOT NULL,               -- 플랫폼 (youtube, instagram 등)
    platform_user_id  VARCHAR2(255)    NULL,                   -- 플랫폼 사용자 ID (채널 ID 등)
    email             VARCHAR2(255)    NULL,                   -- 연동된 이메일
    access_token      VARCHAR2(2000)   NOT NULL,               -- 액세스 토큰 (암호화 저장)
    refresh_token     VARCHAR2(2000)   NULL,                   -- 리프레시 토큰 (암호화 저장)
    token_expires_at  DATE             NULL,                   -- 토큰 만료 시간
    connected_at      DATE DEFAULT SYSDATE NOT NULL,          -- 연동일
    del_yn            CHAR(1) DEFAULT 'N' NOT NULL            -- 삭제여부
);

ALTER TABLE social_connection
    ADD CONSTRAINT PK_SOCIAL_CONNECTION
        PRIMARY KEY (conn_id);

ALTER TABLE social_connection
    ADD CONSTRAINT FK_SOCIAL_CONN_USER
        FOREIGN KEY (user_id)
        REFERENCES user_info (id);

CREATE SEQUENCE SEQ_SOCIAL_CONNECTION
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;

CREATE OR REPLACE TRIGGER TRG_SOCIAL_CONNECTION_PK
BEFORE INSERT ON social_connection
FOR EACH ROW
WHEN (NEW.conn_id IS NULL)
BEGIN
    SELECT SEQ_SOCIAL_CONNECTION.NEXTVAL
      INTO :NEW.conn_id
      FROM dual;
END;

COMMENT ON TABLE social_connection IS '소셜 미디어 연동 테이블';

COMMENT ON COLUMN social_connection.conn_id          IS '연동ID';
COMMENT ON COLUMN social_connection.user_id          IS '유저번호';
COMMENT ON COLUMN social_connection.platform         IS '플랫폼 (youtube, instagram)';
COMMENT ON COLUMN social_connection.platform_user_id IS '플랫폼 사용자 ID (YouTube 채널 ID 등)';
COMMENT ON COLUMN social_connection.email            IS '연동된 이메일';
COMMENT ON COLUMN social_connection.access_token     IS '액세스 토큰 (암호화 저장)';
COMMENT ON COLUMN social_connection.refresh_token    IS '리프레시 토큰 (암호화 저장)';
COMMENT ON COLUMN social_connection.token_expires_at IS '토큰 만료 시간';
COMMENT ON COLUMN social_connection.connected_at     IS '연동일';
COMMENT ON COLUMN social_connection.del_yn           IS '삭제여부';

------------------------------------------------------------------------------------------------------------------------
-- generation_like 테이블
CREATE TABLE generation_like (
    prod_id    NUMBER       NOT NULL,                      -- 생성물 번호 (FK → GENERATION_PROD.PROD_ID)
    user_id    NUMBER       NOT NULL,                      -- 유저 번호   (FK → USER_INFO.ID)
    create_dt  DATE         DEFAULT SYSDATE NOT NULL,      -- 좋아요한 일시
    CONSTRAINT PK_GENERATION_LIKE PRIMARY KEY (prod_id, user_id)
);

ALTER TABLE generation_like
    ADD CONSTRAINT FK_GEN_LIKE_PROD
        FOREIGN KEY (prod_id)
        REFERENCES GENERATION_PROD (PROD_ID);

ALTER TABLE generation_like
    ADD CONSTRAINT FK_GEN_LIKE_USER
        FOREIGN KEY (user_id)
        REFERENCES USER_INFO (ID);

CREATE OR REPLACE TRIGGER trg_gen_like_ai
AFTER INSERT ON generation_like
FOR EACH ROW
BEGIN
    UPDATE generation_prod
       SET like_cnt = like_cnt + 1
     WHERE prod_id = :NEW.prod_id;
END;

CREATE OR REPLACE TRIGGER trg_gen_like_ad
AFTER DELETE ON generation_like
FOR EACH ROW
BEGIN
    UPDATE generation_prod
       SET like_cnt = like_cnt - 1
     WHERE prod_id = :OLD.prod_id;
END;

COMMENT ON TABLE generation_like IS '유저별 생성물 좋아요 테이블';
COMMENT ON COLUMN generation_like.prod_id   IS '생성물 번호';
COMMENT ON COLUMN generation_like.user_id   IS '유저 번호';
COMMENT ON COLUMN generation_like.create_dt IS '좋아요 일시';

------------------------------------------------------------------------------------------------------------------------
-- comments 테이블 (생성물 댓글)
CREATE TABLE comments (
    comment_id   NUMBER          NOT NULL,                  -- 댓글 번호 (PK)
    prod_id      NUMBER          NOT NULL,                  -- 생성물 번호 (FK → generation_prod.prod_id)
    user_id      NUMBER          NOT NULL,                  -- 작성자 유저 번호 (FK → user_info.id)
    content      VARCHAR2(2000)  NOT NULL,                  -- 댓글 내용
    create_dt    DATE            DEFAULT SYSDATE NOT NULL,  -- 작성일
    update_dt    DATE            DEFAULT SYSDATE NOT NULL,  -- 수정일
    del_yn       CHAR(1)         DEFAULT 'N' NOT NULL,      -- 삭제여부 (Y/N)
    CONSTRAINT pk_comments PRIMARY KEY (comment_id)
);

ALTER TABLE comments
    ADD CONSTRAINT fk_comments_prod
        FOREIGN KEY (prod_id)
        REFERENCES generation_prod (prod_id);

ALTER TABLE comments
    ADD CONSTRAINT fk_comments_user
        FOREIGN KEY (user_id)
        REFERENCES user_info (id);

CREATE SEQUENCE seq_comments
    START WITH 1
    INCREMENT BY 1
    NOCACHE;

CREATE OR REPLACE TRIGGER trg_comments_bi
BEFORE INSERT ON comments
FOR EACH ROW
BEGIN
    IF :NEW.comment_id IS NULL THEN
        :NEW.comment_id := seq_comments.NEXTVAL;
    END IF;
END;

CREATE OR REPLACE TRIGGER trg_comments_bu
BEFORE UPDATE ON comments
FOR EACH ROW
BEGIN
    :NEW.update_dt := SYSDATE;
END;

COMMENT ON TABLE comments IS '생성물 댓글 테이블';
COMMENT ON COLUMN comments.comment_id IS '댓글 번호';
COMMENT ON COLUMN comments.prod_id    IS '생성물 번호';
COMMENT ON COLUMN comments.user_id    IS '작성자 유저 번호';
COMMENT ON COLUMN comments.content    IS '댓글 내용';
COMMENT ON COLUMN comments.create_dt  IS '작성일';
COMMENT ON COLUMN comments.update_dt  IS '수정일';
COMMENT ON COLUMN comments.del_yn     IS '삭제여부';

------------------------------------------------------------------------------------------------------------------------

-- oauth_identity 테이블 (구글 로그인)
CREATE TABLE oauth_identity (
    oauth_id         NUMBER        NOT NULL,          -- PK
    user_id          NUMBER        NOT NULL,          -- FK → user_info.id
    provider         VARCHAR2(50)  NOT NULL,          -- 'google'
    provider_user_id VARCHAR2(255) NOT NULL,          -- Google sub (고유 ID)
    email            VARCHAR2(255) NULL,              -- 구글 이메일
    create_dt        DATE DEFAULT SYSDATE NOT NULL,   -- 생성일
    update_dt        DATE DEFAULT SYSDATE NOT NULL,   -- 수정일
    del_yn           CHAR(1) DEFAULT 'N' NOT NULL,    -- 삭제여부
    CONSTRAINT pk_oauth_identity PRIMARY KEY (oauth_id),
    CONSTRAINT fk_oauth_identity_user
        FOREIGN KEY (user_id) REFERENCES user_info(id)
);

CREATE SEQUENCE seq_oauth_identity
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;

CREATE OR REPLACE TRIGGER trg_oauth_identity_bi
BEFORE INSERT ON oauth_identity
FOR EACH ROW
BEGIN
    IF :NEW.oauth_id IS NULL THEN
        :NEW.oauth_id := seq_oauth_identity.NEXTVAL;
    END IF;
END;

CREATE OR REPLACE TRIGGER trg_oauth_identity_bu
BEFORE UPDATE ON oauth_identity
FOR EACH ROW
BEGIN
    :NEW.update_dt := SYSDATE;
END;

COMMENT ON TABLE oauth_identity IS 'OAuth 인증 정보 테이블 (구글 로그인)';

COMMENT ON COLUMN oauth_identity.oauth_id         IS 'OAuth 인증 ID';
COMMENT ON COLUMN oauth_identity.user_id          IS '유저번호';
COMMENT ON COLUMN oauth_identity.provider         IS '제공자 (google)';
COMMENT ON COLUMN oauth_identity.provider_user_id IS '제공자 사용자 ID (Google sub)';
COMMENT ON COLUMN oauth_identity.email            IS '구글 이메일';
COMMENT ON COLUMN oauth_identity.create_dt        IS '생성일';
COMMENT ON COLUMN oauth_identity.update_dt        IS '수정일';
COMMENT ON COLUMN oauth_identity.del_yn           IS '삭제여부';

-- UNIQUE 제약조건: 같은 구글 계정 중복 방지
ALTER TABLE oauth_identity
    ADD CONSTRAINT uk_oauth_prov_user
        UNIQUE (provider, provider_user_id);

------------------------------------------------------------------------------------------------------------------------

-- social_post 테이블 (유튜브, 인스타 업로드)
CREATE TABLE social_post (
    post_id            NUMBER          NOT NULL,                 -- PK
    prod_id            NUMBER          NOT NULL,                 -- 생성물 → generation_prod.prod_id
    conn_id            NUMBER          NOT NULL,                 -- 연동 계정 → social_connection.conn_id
    platform           VARCHAR2(50)    NOT NULL,                 -- 'youtube', 'instagram'
    platform_post_id   VARCHAR2(255)   NULL,                     -- YouTube videoId, 인스타 mediaId
    platform_url       VARCHAR2(1000)  NULL,                     -- 실제 URL
    status             VARCHAR2(20)    DEFAULT 'PENDING' NOT NULL,  -- PENDING / SUCCESS / FAIL / DELETED 등
    error_code         VARCHAR2(100)   NULL,                     -- 실패 시 코드
    error_message      VARCHAR2(1000)  NULL,                     -- 실패 시 메시지
    requested_at       DATE            DEFAULT SYSDATE NOT NULL, -- 업로드 요청 시각
    posted_at          DATE            NULL,                     -- 실제 업로드 완료 시각
    last_checked_at    DATE            NULL,                     -- 마지막 로그/통계 조회 시각
    del_yn             CHAR(1)         DEFAULT 'N' NOT NULL,     -- 삭제여부
    CONSTRAINT pk_social_post PRIMARY KEY (post_id),
    CONSTRAINT fk_social_post_prod
        FOREIGN KEY (prod_id) REFERENCES generation_prod(prod_id),
    CONSTRAINT fk_social_post_conn
        FOREIGN KEY (conn_id) REFERENCES social_connection(conn_id),
    CONSTRAINT ck_social_post_status
        CHECK (status IN ('PENDING', 'SUCCESS', 'FAIL', 'DELETED'))
);

CREATE SEQUENCE seq_social_post
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;

CREATE OR REPLACE TRIGGER trg_social_post_bi
BEFORE INSERT ON social_post
FOR EACH ROW
BEGIN
    IF :NEW.post_id IS NULL THEN
        :NEW.post_id := seq_social_post.NEXTVAL;
    END IF;
END;

COMMENT ON TABLE social_post IS '소셜 미디어 게시물 테이블';

COMMENT ON COLUMN social_post.post_id            IS '게시물 ID';
COMMENT ON COLUMN social_post.prod_id            IS '생성물 번호';
COMMENT ON COLUMN social_post.conn_id            IS '연동 계정 ID';
COMMENT ON COLUMN social_post.platform           IS '플랫폼 (youtube, instagram)';
COMMENT ON COLUMN social_post.platform_post_id   IS '플랫폼 게시물 ID (YouTube videoId, Instagram mediaId)';
COMMENT ON COLUMN social_post.platform_url       IS '플랫폼 게시물 URL';
COMMENT ON COLUMN social_post.status             IS '업로드 상태 (PENDING/SUCCESS/FAIL/DELETED)';
COMMENT ON COLUMN social_post.error_code         IS '실패 시 에러 코드';
COMMENT ON COLUMN social_post.error_message      IS '실패 시 에러 메시지';
COMMENT ON COLUMN social_post.requested_at       IS '업로드 요청 시각';
COMMENT ON COLUMN social_post.posted_at          IS '실제 업로드 완료 시각';
COMMENT ON COLUMN social_post.last_checked_at    IS '마지막 로그/통계 조회 시각';
COMMENT ON COLUMN social_post.del_yn             IS '삭제여부';

------------------------------------------------------------------------------------------------------------------------

-- social_post_metric 테이블 (업로드된 쇼츠영상 로그 수집)
CREATE TABLE social_post_metric (
    metric_id      NUMBER        NOT NULL,                -- PK
    post_id        NUMBER        NOT NULL,                -- FK → social_post.post_id
    captured_at    DATE          DEFAULT SYSDATE NOT NULL,-- 수집 시각
    view_cnt       NUMBER        DEFAULT 0 NOT NULL,      -- 조회수
    like_cnt       NUMBER        DEFAULT 0 NOT NULL,      -- 좋아요수
    comment_cnt    NUMBER        DEFAULT 0 NOT NULL,      -- 댓글수
    share_cnt      NUMBER        NULL,          -- 공유수 (플랫폼별로 다르므로 NULL 허용)
    CONSTRAINT pk_social_post_metric PRIMARY KEY (metric_id),
    CONSTRAINT fk_social_post_metric_post
        FOREIGN KEY (post_id) REFERENCES social_post(post_id)
);

CREATE SEQUENCE seq_social_post_metric
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;

CREATE OR REPLACE TRIGGER trg_social_post_metric_bi
BEFORE INSERT ON social_post_metric
FOR EACH ROW
BEGIN
    IF :NEW.metric_id IS NULL THEN
        :NEW.metric_id := seq_social_post_metric.NEXTVAL;
    END IF;
END;

COMMENT ON TABLE social_post_metric IS '소셜 미디어 게시물 메트릭 테이블';

COMMENT ON COLUMN social_post_metric.metric_id   IS '메트릭 ID';
COMMENT ON COLUMN social_post_metric.post_id     IS '게시물 ID';
COMMENT ON COLUMN social_post_metric.captured_at IS '수집 시각';
COMMENT ON COLUMN social_post_metric.view_cnt    IS '조회수';
COMMENT ON COLUMN social_post_metric.like_cnt    IS '좋아요수';
COMMENT ON COLUMN social_post_metric.comment_cnt IS '댓글수';
COMMENT ON COLUMN social_post_metric.share_cnt   IS '공유수 (플랫폼별로 다르므로 NULL 허용)';
