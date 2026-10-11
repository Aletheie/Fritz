import type { Component } from 'svelte';

export type NavigationItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: Component;
  active: boolean;
};
