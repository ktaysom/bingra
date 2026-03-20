import type { Metadata } from "next";
import { redirect } from "next/navigation";

type HostPageProps = {
  params: {
    slug: string;
  };
};

export const metadata: Metadata = {
  title: "Host Game",
};

export default async function HostPage(props: HostPageProps) {
  const { slug } = await props.params;
  redirect(`/g/${slug}/play`);
}