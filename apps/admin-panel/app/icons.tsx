const paths = {
  home: 'M3 10.5 12 3l9 7.5M5.5 8.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V8.5',
  monitor: 'M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8.5 21h7M12 17v4',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
  calendar: 'M7 3v4M17 3v4M4 9.5h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  cpu: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  chart: 'M4 20V4M4 20h16M8.5 16v-5M13 16V8M17.5 16v-3',
  megaphone: 'M4 10v4a1 1 0 0 0 1 1h3l9 5V4L8 9H5a1 1 0 0 0-1 1ZM8 15l1.5 5h2.5l-1.3-4M20 10v4',
  school: 'M12 4 2 9l10 5 10-5-10-5ZM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.500M22 9v6',
  image: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM3 16l5-5 4 4 3-3 6 6M15.500 8.500h.01',
  video: 'M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM16 10.500l5-3v9l-5-3',
  alert: 'M12 3.500 2.500 20h19L12 3.500ZM12 10v4.500M12 17.500h.01',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  refresh: 'M20 11a8 8 0 0 0-14.300-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14.300 4L20 15M20 20v-5h-5',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2.500v2M12 19.500v2M4.300 4.300l1.400 1.400M18.300 18.300l1.400 1.400M2.500 12h2M19.500 12h2M4.300 19.700l1.400-1.400M18.300 5.700l1.400-1.400',
  moon: 'M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500Z',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16.500 14.500 12 10 7.500M14.500 12H4',
  close: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19.500 8.500a2 2 0 0 0 0-2.800l-1.200-1.200a2 2 0 0 0-2.800 0L4 16v4ZM14 6l4 4',
  trash: 'M4 7h16M9.500 7V4h5v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  link: 'M10 14a4.500 4.500 0 0 0 6.400 0l3-3a4.500 4.500 0 0 0-6.400-6.400l-1 1M14 10a4.500 4.500 0 0 0-6.400 0l-3 3a4.500 4.500 0 0 0 6.400 6.400l1-1',
  play: 'M7 4.500v15l12-7.500-12-7.500Z',
  stop: 'M6 6h12v12H6z',
  eye: 'M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12ZM12 9.500a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5Z',
  eyeOff: 'M4 4l16 16M10 5.700A9 9 0 0 1 12 5.500c6 0 9.500 6.500 9.500 6.500a17 17 0 0 1-3 3.800M6.500 7.500A16 16 0 0 0 2.500 12S6 18.500 12 18.500a9 9 0 0 0 4.300-1.100M10.300 10.300a2.500 2.500 0 0 0 3.400 3.400',
  upload: 'M12 16V4M7.500 8.500 12 4l4.500 4.500M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  file: 'M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v5h5',
  check: 'm5 12.500 4.500 4.500L19 7.500',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  chevronLeft: 'M15 5.500 8.500 12l6.500 6.500',
  chevronRight: 'M9 5.500 15.500 12 9 18.500',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7.500V12l3 2',
  mapPin: 'M12 21s7-6 7-11.500a7 7 0 1 0-14 0C5 15 12 21 12 21ZM12 7a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5Z',
  shield: 'M12 3 5 5.500V11c0 5 3 8.500 7 10 4-1.500 7-5 7-10V5.500L12 3ZM9 12l2 2 4-4',
  camera: 'M4 7h3l1.500-2.500h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM12 10a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7Z',
  users: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7ZM2.500 20c.5-3.500 3-5.500 6.500-5.500s6 2 6.500 5.500M16 4.300a3.500 3.500 0 0 1 0 6.400M18 14.800c1.900.8 3.200 2.600 3.500 5.200',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width={size}>
      <path d={paths[name]} />
    </svg>
  );
}

export function BrandLockup() {
  return <span className="brand-lockup"><strong>Anadolu Üniversitesi</strong><small>Bilişim Teknolojileri Meslek Yüksekokulu</small></span>;
}
