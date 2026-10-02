import Hero from "@/components/Hero";
import Infocard from "@/components/infocard";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-[##F7F7F8] text-[#111111]">
      <Navbar />

      <Hero />
      <Infocard />

      {/* <section className="flex justify-center px-6 pb-20 pt-16">
        <ChatInput />
      </section> */}
    </main>
  );
}
