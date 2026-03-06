'use client';

import type { ReactNode } from 'react';
import NextLink from 'next/link';
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';

type NavigateOptions = {
  replace?: boolean;
};

type SearchParamsInit = string | URLSearchParams | Record<string, string>;

interface LinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}

export function Link({ to, className, children, onClick, title }: LinkProps) {
  if (to.startsWith('#')) {
    return (
      <a href={to} className={className} onClick={onClick} title={title}>
        {children}
      </a>
    );
  }

  return (
    <NextLink href={to} className={className} onClick={onClick} title={title}>
      {children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();

  return (to: string, options?: NavigateOptions) => {
    if (options?.replace) {
      router.replace(to);
      return;
    }

    router.push(to);
  };
}

export function useLocation() {
  const pathname = usePathname() || '/';
  const searchParams = useNextSearchParams();
  const search = searchParams?.toString();

  return {
    pathname,
    search: search ? `?${search}` : '',
    hash: '',
    state: null,
    key: pathname,
  };
}

export function useParams<T extends Record<string, string | string[]>>() {
  return useNextParams<T>();
}

export function useSearchParams() {
  const pathname = usePathname() || '/';
  const searchParams = useNextSearchParams();
  const navigate = useNavigate();

  const setSearchParams = (next: SearchParamsInit) => {
    const params =
      next instanceof URLSearchParams
        ? next
        : typeof next === 'string'
          ? new URLSearchParams(next)
          : new URLSearchParams(Object.entries(next));

    const query = params.toString();
    navigate(query ? `${pathname}?${query}` : pathname);
  };

  return [new URLSearchParams(searchParams?.toString() || ''), setSearchParams] as const;
}
