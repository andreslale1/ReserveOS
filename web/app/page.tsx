import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import ProblemSolution from "@/components/problem-solution";
import HowItWorks from "@/components/how-it-works";
import Modules from "@/components/modules";
import FinalCta from "@/components/final-cta";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="bg-void text-ink">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Modules />
        <ProblemSolution />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
