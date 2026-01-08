import { ErrorBoundary } from "react-error-boundary";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/trpc/server";
import { getSession } from "@/lib/auth";

import { LandingPageContents } from "./_ui/landing-page-contents";

const LandingPage = async () => {
  const session = await getSession();

  if(session) redirect("/home");

  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary fallback={<div>There was an error</div>}>
        <Suspense fallback={<div>Loading...</div>}>
          <LandingPageContents/>
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default LandingPage;