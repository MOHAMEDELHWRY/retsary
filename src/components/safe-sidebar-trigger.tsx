"use client";

import React from 'react';
import { SidebarTrigger, useSidebar } from './ui/sidebar';

export function SafeSidebarTrigger() {
  try {
    // Try to access the sidebar context
    const sidebar = useSidebar();
    return <SidebarTrigger />;
  } catch (error) {
    // If the context is not available, render nothing or a placeholder
    console.warn('SidebarProvider context not available, skipping SidebarTrigger');
    return null;
  }
}
