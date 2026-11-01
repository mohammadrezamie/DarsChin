import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Landing } from '../src/pages/Landing';

const renderLanding = () => renderToStaticMarkup(
  <MemoryRouter>
    <Landing />
  </MemoryRouter>,
);

describe('responsive landing navigation', () => {
  it('renders a labeled, initially collapsed mobile menu toggle', () => {
    const html = renderLanding();

    expect(html).toContain('aria-controls="landing-mobile-navigation"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="باز کردن منوی ناوبری"');
    expect(html).toContain('aria-label="ناوبری موبایل"');
  });

  it.each([
    ['eligibility', 'قوانین آموزشی'],
    ['recommendations', 'پیشنهاد درس'],
    ['schedule', 'برنامه هفتگی'],
    ['data-flow', 'ورود داده'],
    ['workspaces', 'امکانات سامانه'],
  ])('offers a link to the existing %s section', (id, label) => {
    const html = renderLanding();

    expect(html).toContain(`href="#${id}"`);
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain(label);
  });

  it('keeps sign-in and registration reachable from the mobile menu', () => {
    const html = renderLanding();

    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/register"');
  });
});
