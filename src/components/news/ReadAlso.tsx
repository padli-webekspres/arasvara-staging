import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { resolvePublicArticleHref } from "@/lib/article-public-path";

interface ReadAlsoProps {
  slug: string;
  title: string;
  publicPath?: string | null;
}

const ReadAlso = ({ slug, title, publicPath }: ReadAlsoProps) => {
  if (!slug || !title) return null;

  const href = resolvePublicArticleHref({ slug, publicPath });

  return (
    <Link
      href={href}
      className="my-8 group rounded-xl overflow-hidden flex justify-between items-center px-4 md:px-6 bg-muted/30 relative transition-all duration-300 ease-in-out"
    >
      <div className="block w-2 h-full bg-hijauSawah left-0 top-0 absolute" />
      <div className="space-y-4 py-3">
        <p className="mb-0 font-thin text-sm text-hijauSawah">Baca Juga:</p>
        <p className="mb-0 group-hover:text-hijauSawah transition-all duration-300 ease-in-out">
          {title}
        </p>
      </div>
      <Button
        variant={"outline"}
        className="aspect-square rounded-full h-10 group-hover:bg-hijauSawah transition-all duration-300 group-hover:text-white hover:text-white hover:bg-hijauSawah"
      >
        <ArrowRight className="h-8 w-8" />
      </Button>
    </Link>
  );
};

export default ReadAlso;
