import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./app/Layout";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } },
});

function Placeholder({ title }: { title: string }) {
  return <h1 style={{ fontSize: 28, fontWeight: 600 }}>{title}</h1>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Placeholder title="Início" />} />
            <Route path="*" element={<Placeholder title="Em breve" />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
