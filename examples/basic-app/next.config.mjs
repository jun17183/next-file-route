import { withFileRoute } from 'next-file-route/plugin'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

export default withFileRoute(nextConfig)
