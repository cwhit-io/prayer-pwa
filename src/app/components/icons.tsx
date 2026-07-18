import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function SvgIcon({ children, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      {children}
    </svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 18h16l-1.4-10.4-4.4 4.2L12 4l-2.2 7.8-4.4-4.2L4 18Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M5 21h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m9 7 8 5-8 5V7Z" fill="currentColor" />
    </SvgIcon>
  );
}

export function PromptIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v15H7.5A2.5 2.5 0 0 0 5 20.5v-15Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M5 5.5A2.5 2.5 0 0 0 2.5 3H2v15h.5A2.5 2.5 0 0 1 5 20.5" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M9 8h7M9 12h5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5V12l3.2 2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function FamilyIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="10" r="2.4" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M13.5 20a4.5 4.5 0 0 1 7 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function FriendsIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M7 12.5 12 17l5-4.5a3.2 3.2 0 0 0 0-4.7 3.4 3.4 0 0 0-4.8 0L12 8l-.2-.2a3.4 3.4 0 0 0-4.8 0 3.2 3.2 0 0 0 0 4.7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M4 21h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function CityIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 21h18M5 21V9l5-3v15M10 21V4h6v17M16 21V11l3-2v12" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M7 12h1M7 15h1M12 8h2M12 12h2M12 16h2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 22c4 0 7-2.7 7-6.8 0-3.2-2.1-5.3-4.3-7.5-.9 2.4-2.4 3.5-4 4.4.4-3.3-.8-6.2-3.5-8.1.2 4.5-2.2 6.4-2.2 10.8C5 19.1 8 22 12 22Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M3 20h18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m3 11 9-7 9 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M5.5 10v10h13V10" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </SvgIcon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="M20 12a8 8 0 1 1-2.3-5.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path d="M20 4v5h-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </SvgIcon>
  );
}
