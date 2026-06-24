"use client";

import UserReactionsPage from "./reactions/page";
import UserShelvesPage from "./shelves/page";

export default {
  ReactionsEmpty: (
    <div className="p-4">
      <UserReactionsPage />
    </div>
  ),
  ShelvesEmpty: (
    <div className="p-4">
      <UserShelvesPage />
    </div>
  ),
  MobileEmptyStates: (
    <div className="w-80 space-y-4 p-3">
      <UserReactionsPage />
      <UserShelvesPage />
    </div>
  ),
};
