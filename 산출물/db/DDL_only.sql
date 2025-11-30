-- role_mst
create table role_mst (
    role_id   number        not null,
    role_nm   varchar2(255) not null,
    del_yn    char(1)       default 'N' not null,
    constraint pk_role primary key (role_id)
);

-- user_info
create table user_info (
    id            number        not null,
    login_id      varchar2(255) not null,
    password_hash varchar2(255) not null,
    nickname      varchar2(255) not null,
    status        char(1)       default 'Y' not null,
    create_dt     date          default sysdate not null,
    update_dt     date          default sysdate not null,
    role_id       number        not null,
    constraint pk_user_info primary key (id),
    constraint fk_user_info_role
        foreign key (role_id) references role_mst(role_id)
);

-- menu
create table menu (
    menu_id     number        not null,
    menu_nm     varchar2(255) not null,
    up_menu_id  number        null,
    menu_path   varchar2(255) not null,
    del_yn      char(1)       default 'N' not null,
    menu_order  number        null,
    constraint pk_menu primary key (menu_id)
);

-- role_menu
create table role_menu (
    role_id number not null,
    menu_id number not null,
    constraint pk_role_menu primary key (role_id, menu_id),
    constraint fk_role_menu_role
        foreign key (role_id) references role_mst(role_id),
    constraint fk_role_menu_menu
        foreign key (menu_id) references menu(menu_id)
);

-- prod_grp (프로젝트/그룹)
create table prod_grp (
    grp_id     number        not null,
    grp_nm     varchar2(255) not null,
    grp_desc   varchar2(1000) null,
    creator_id number        not null,
    updater_id number        null,
    create_dt  date          default sysdate not null,
    update_dt  date          default sysdate not null,
    del_yn     char(1)       default 'N' not null,
    constraint pk_prod_grp primary key (grp_id),
    constraint fk_prod_user
        foreign key (creator_id) references user_info(id),
    constraint fk_prod_upd_user
        foreign key (updater_id) references user_info(id)
);

-- prod_type
create table prod_type (
    type_id number        not null,
    type_nm varchar2(255) null,
    del_yn  char(1)       default 'N' not null,
    constraint pk_prod_type primary key (type_id)
);

-- brand_info
create table brand_info (
    grp_id           number         not null,
    brand_name       varchar2(255)  not null,
    category         varchar2(255)  not null,
    tone_mood        varchar2(255)  null,
    core_keywords    varchar2(1000) null,
    slogan           varchar2(500)  null,
    target_age       varchar2(100)  null,
    target_gender    varchar2(50)   null,
    avoided_trends   varchar2(1000) null,
    preferred_colors varchar2(500)  null,
    create_dt        date           default sysdate not null,
    update_dt        date           default sysdate not null,
    constraint pk_brand_info primary key (grp_id),
    constraint fk_brand_info_grp
        foreign key (grp_id) references prod_grp(grp_id)
);

-- generation_prod
create table generation_prod (
    prod_id     number         not null,
    type_id     number         not null,
    grp_id      number         not null,
    file_path   varchar2(1000) not null,
    view_cnt    number         default 0 not null,
    ref_cnt     number         default 0 not null,
    like_cnt    number         default 0 not null,
    pub_yn      char(1)        default 'N' not null,
    create_user number         not null,
    create_dt   date           default sysdate not null,
    update_user number         null,
    update_dt   date           default sysdate not null,
    del_yn      char(1)        default 'N' not null,
    constraint pk_generation_prod primary key (prod_id),
    constraint fk_gen_prod_type
        foreign key (type_id) references prod_type(type_id),
    constraint fk_gen_prod_grp
        foreign key (grp_id) references prod_grp(grp_id),
    constraint fk_gen_prod_crt_user
        foreign key (create_user) references user_info(id),
    constraint fk_gen_prod_upd_user
        foreign key (update_user) references user_info(id)
);

-- social_connection
create table social_connection (
    conn_id          number        not null,
    user_id          number        not null,
    platform         varchar2(50)  not null,
    platform_user_id varchar2(255) null,
    email            varchar2(255) null,
    access_token     varchar2(2000) not null,
    refresh_token    varchar2(2000) null,
    token_expires_at date          null,
    connected_at     date          default sysdate not null,
    del_yn           char(1)       default 'N' not null,
    constraint pk_social_connection primary key (conn_id),
    constraint fk_social_conn_user
        foreign key (user_id) references user_info(id)
);

-- oauth_identity
create table oauth_identity (
    oauth_id         number        not null,
    user_id          number        not null,
    provider         varchar2(50)  not null,
    provider_user_id varchar2(255) not null,
    email            varchar2(255) null,
    create_dt        date          default sysdate not null,
    update_dt        date          default sysdate not null,
    del_yn           char(1)       default 'N' not null,
    constraint pk_oauth_identity primary key (oauth_id),
    constraint fk_oauth_identity_user
        foreign key (user_id) references user_info(id),
    constraint uk_oauth_prov_user
        unique (provider, provider_user_id)
);

-- generation_like
create table generation_like (
    prod_id   number not null,
    user_id   number not null,
    create_dt date   default sysdate not null,
    constraint pk_generation_like primary key (prod_id, user_id),
    constraint fk_gen_like_prod
        foreign key (prod_id) references generation_prod(prod_id),
    constraint fk_gen_like_user
        foreign key (user_id) references user_info(id)
);

-- comments
create table comments (
    comment_id number         not null,
    prod_id    number         not null,
    user_id    number         not null,
    content    varchar2(2000) not null,
    create_dt  date           default sysdate not null,
    update_dt  date           default sysdate not null,
    del_yn     char(1)        default 'N' not null,
    constraint pk_comments primary key (comment_id),
    constraint fk_comments_prod
        foreign key (prod_id) references generation_prod(prod_id),
    constraint fk_comments_user
        foreign key (user_id) references user_info(id)
);

-- social_post
create table social_post (
    post_id          number         not null,
    prod_id          number         not null,
    conn_id          number         not null,
    platform         varchar2(50)   not null,
    platform_post_id varchar2(255)  null,
    platform_url     varchar2(1000) null,
    status           varchar2(20)   default 'PENDING' not null,
    error_code       varchar2(100)  null,
    error_message    varchar2(1000) null,
    requested_at     date           default sysdate not null,
    posted_at        date           null,
    last_checked_at  date           null,
    del_yn           char(1)        default 'N' not null,
    constraint pk_social_post primary key (post_id),
    constraint fk_social_post_prod
        foreign key (prod_id) references generation_prod(prod_id),
    constraint fk_social_post_conn
        foreign key (conn_id) references social_connection(conn_id)
);

-- social_post_metric
create table social_post_metric (
    metric_id   number not null,
    post_id     number not null,
    captured_at date   default sysdate not null,
    view_cnt    number default 0 not null,
    like_cnt    number default 0 not null,
    comment_cnt number default 0 not null,
    share_cnt   number null,
    constraint pk_social_post_metric primary key (metric_id),
    constraint fk_social_post_metric_post
        foreign key (post_id) references social_post(post_id)
);
