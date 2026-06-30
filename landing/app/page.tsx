import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Demo } from "@/components/Demo";
import { Comparison } from "@/components/Comparison";
import { HowItWorks } from "@/components/HowItWorks";
import { DestinationsGuards } from "@/components/DestinationsGuards";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <Demo />
      <Comparison />
      <HowItWorks />
      <DestinationsGuards />
      <CTA />
      <Footer />
    </>
  );
}
