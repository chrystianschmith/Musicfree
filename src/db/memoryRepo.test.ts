import { repoContract } from "./repoContract";
import { MemoryRepo } from "./memoryRepo";

repoContract("memory", async () => new MemoryRepo());
