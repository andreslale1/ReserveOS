import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import ProblemSolution from "@/components/problem-solution";
import HowItWorks from "@/components/how-it-works";
import Modules from "@/components/modules";
import FirstStudio from "@/components/first-studio";
import FinalCta from "@/components/final-cta";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="bg-void text-white">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ProblemSolution />
        <HowItWorks />
        <Modules />
        <FirstStudio />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
