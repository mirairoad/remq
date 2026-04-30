import { Head } from "@hushkey/howl/runtime";
import type { JSX } from "preact/jsx-dev-runtime";

export default function Error({ error }: { error: unknown }): JSX.Element {
  const errorMap = {
    404: "Not Found",
    500: "Internal Server Error",
    403: "Forbidden",
    401: "Unauthorized",
    400: "Bad Request",
  };
  const status = (error as { status: number })?.status ?? 500;
  const message = errorMap[status as keyof typeof errorMap] ?? "Unknown error";

  return (
    <>
      <Head>
        <title>Error {message}</title>
      </Head>
      <div class="pt-20 pb-40 flex justify-center px-5 bg-base-100 min-h-screen">
        <div class="text-center w-full max-w-2xl">
          <h1 class="text-6xl sm:text-6xl font-bold mb-4 text-error">{status}</h1>
          <h2 class="text-3xl sm:text-3xl font-semibold mb-2">Oops!</h2>
          <p class="text-lg sm:text-lg mb-3 text-base-content/70">{message}</p>
          <p class="text-base mb-8 text-base-content/60 leading-relaxed">
            The page you're looking for could not be found.
          </p>
          <a href="/" class="btn btn-primary btn-md rounded-lg mt-4" f-client-nav>
            Go Back Home
          </a>
        </div>
      </div>
    </>
  );
}
