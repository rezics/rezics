"use client";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { UserProfileContent } from "./content";

const longProfile = {
  avatarFallback: "长",
  displayName: "一个显示名非常非常非常长的跨语言目录协作者用于测试标题截断",
  handle: "user-with-a-very-long-handle-for-layout-pressure",
  bio: "这个简介故意写得比较长：用户正在维护多语言作品索引、社区 realm 分类、书架与讨论串之间的关系。它需要在移动端自然换行，在宽屏下保持 max-w-3xl 的阅读宽度。",
};

const privateProfile = {
  avatarFallback: "P",
  displayName: "Private Reader",
  handle: "private-reader",
  bio: "Profile details are private for the current viewer.",
  canFollow: false,
  canMessage: false,
};

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export default {
  Placeholder: (
    <Suspense fallback={<div>Loading...</div>}>
      <Frame>
        <UserProfileContent
          paramsPromise={Promise.resolve({ id: "user-alice" })}
        />
      </Frame>
    </Suspense>
  ),
  LongText: (
    <Suspense fallback={<div>Loading...</div>}>
      <Frame>
        <UserProfileContent
          paramsPromise={Promise.resolve({ id: "user-long" })}
          profile={longProfile}
        />
      </Frame>
    </Suspense>
  ),
  AnonymousViewer: (
    <Suspense fallback={<div>Loading...</div>}>
      <Frame>
        <UserProfileContent
          paramsPromise={Promise.resolve({ id: "user-alice" })}
          profile={{
            avatarFallback: "A",
            displayName: "Alice Chen",
            handle: "alice",
            bio: "Anonymous viewers can inspect the public profile, then sign in before following.",
            isAnonymousViewer: true,
            canMessage: false,
          }}
        />
      </Frame>
    </Suspense>
  ),
  PrivateProfile: (
    <Suspense fallback={<div>Loading...</div>}>
      <Frame>
        <UserProfileContent
          paramsPromise={Promise.resolve({ id: "private-reader" })}
          profile={privateProfile}
        />
      </Frame>
    </Suspense>
  ),
  MobilePressure: (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="w-80 p-3">
        <UserProfileContent
          paramsPromise={Promise.resolve({ id: "user-long" })}
          profile={longProfile}
        />
      </div>
    </Suspense>
  ),
};
