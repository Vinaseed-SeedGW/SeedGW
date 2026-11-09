import Image from 'next/image';

const LOGO_SIZES = {
  s: { width: 120, height: 30 },
  m: { width: 160, height: 40 },
  l: { width: 200, height: 50 },
  xl: { width: 280, height: 70 },
} as const;

type LogoProps = {
  variant: 'color' | 'white' | 'bw-light';
  size: keyof typeof LOGO_SIZES;
};

export function Logo({ variant, size }: LogoProps) {
  const { width, height } = LOGO_SIZES[size];
  return (
    <Image
      src={`/brand/vinaseed-logo-${variant}.svg`}
      width={width}
      height={height}
      alt="Vinaseed - A member of the PAN Group"
      unoptimized
      loading="eager"
    />
  );
}

type LogoSymbolProps = {
  variant: 'green' | 'white';
  width: 32 | 48;
};

export function LogoSymbol({ variant, width }: LogoSymbolProps) {
  return (
    <Image
      src={`/brand/vinaseed-symbol-${variant}.svg`}
      width={width}
      height={width}
      alt="Vinaseed"
      unoptimized
      loading="eager"
    />
  );
}
