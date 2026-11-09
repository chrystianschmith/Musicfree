import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./app/Layout";
import { HomePage } from "./features/home/HomePage";
import { ExplorePage } from "./features/explore/ExplorePage";
import { SearchPage } from "./features/search/SearchPage";
import { ArtistPage } from "./features/artist/ArtistPage";
import { AlbumRoute, PlaylistRoute } from "./features/collection/routes";
import {
  HistoryPage,
  LikedPage,
  LocalPlaylistPage,
  SavedAlbumsPage,
  SavedArtistsPage,
} from "./features/library/LibraryPages";

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
            <Route index element={<HomePage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="artist/:id" element={<ArtistPage />} />
            <Route path="album/:id" element={<AlbumRoute />} />
            <Route path="playlist/:id" element={<PlaylistRoute />} />
            <Route path="library/liked" element={<LikedPage />} />
            <Route path="library/history" element={<HistoryPage />} />
            <Route path="library/albums" element={<SavedAlbumsPage />} />
            <Route path="library/artists" element={<SavedArtistsPage />} />
            <Route path="library/playlist/:id" element={<LocalPlaylistPage />} />
            <Route path="*" element={<Placeholder title="Em breve" />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
