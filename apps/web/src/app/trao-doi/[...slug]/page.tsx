import { UnderConstruction } from '@/features/shell/components/under-construction';

type PageProps = { params: Promise<{ slug: string[] }> };

export default async function TraoDoiPlaceholderPage({ params }: PageProps) {
  const { slug } = await params;
  return <UnderConstruction slug="trao-doi" segments={slug} />;
}
