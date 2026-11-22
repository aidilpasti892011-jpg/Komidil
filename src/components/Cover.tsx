import Image from "next/image";

type Props = { title: string; hue: number; url: string | null; sizes?: string };

// Cover asli kalau ada, kalau tidak: placeholder gradasi + huruf pertama judul.
export default function Cover({ title, hue, url, sizes = "(min-width:768px) 25vw, 50vw" }: Props) {
  if (url) {
    return <Image src={url} alt={`Cover ${title}`} fill sizes={sizes} className="object-cover" />;
  }
  return (
    <div
      className="grid h-full w-full place-items-center"
      style={{
        background: `linear-gradient(160deg,hsl(${hue},70%,42%),hsl(${(hue + 50) % 360},60%,14%))`,
      }}
    >
      <b className="text-6xl opacity-45">{title.charAt(0).toUpperCase()}</b>
    </div>
  );
}
