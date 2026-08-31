"use client";

import { createContext, useContext } from "react";

const ArticleContentPaginationContext = createContext(false);

export function ArticleContentPaginationProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <ArticleContentPaginationContext.Provider value={enabled}>
      {children}
    </ArticleContentPaginationContext.Provider>
  );
}

export function useArticleContentPaginationEnabled(): boolean {
  return useContext(ArticleContentPaginationContext);
}
