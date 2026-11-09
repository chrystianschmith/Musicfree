import { useExplore } from "../../sources/queries";
import { ShelfRow } from "../shelf/ShelfRow";
import { SectionError, Skeleton } from "../../components/States";
import { TopBar } from "../../app/TopBar";

export function ExplorePage() {
  const q = useExplore();
  return (
    <div>
      <TopBar />
      <h1 style={{ fontSize: 30, fontWeight: 650, margin: "0 0 22px" }}>Explorar</h1>
      {q.isPending && <Skeleton w="100%" h={200} />}
      {q.isError && <SectionError onRetry={() => q.refetch()} />}
      {q.data?.map((shelf, i) => (
        <ShelfRow key={i} shelf={shelf} />
      ))}
    </div>
  );
}
