# Architecture

## Abstract

- user login / register / logout
- CURD book > (meta data > title / author / cover / tag / description / publisher / publish date / isbn) / (thread > title / content / up / down / sub thread)
- CURD user > id, name, avatar, description
- CURD organization > id, name, avatar, description, member, member role

## User Interface

It should be lightweight and simple, not overwhelming for the user, which means it have to follow the classic page flow, so there is no:

- top-level container
- sidebar

### Global Components

- header
    - logo
    - title
    - search
    - user
- footer
    - quick links
    - copyright

### Home

- book preview
    - title
    - author
    - cover
    - tag (top)
    - description (hover)
    - publish date
- category switch
- miscellaneous
    - last / next page
    - ...

### Book

- cover
- title
- publisher
- publish date
- isbn
- tag
- description
    - expand / collapse
- ... meta data
- thread
    - author
    - title
    - content
    - interaction
        - up
        - down
        - favorite
        - reply
        - report
