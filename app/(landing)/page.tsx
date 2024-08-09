import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-24">
      <div className="flex flex-col gap-2 items-center">
        <span className="bg-clip-text text-5xl font-extrabold text-transparent bg-gradient-to-r from-[#5dc1f6] to-[#e2b9f7]">
          Ziggo-ChatAI
        </span>
        <span className="max-w-2xl text-center font-semibold text-xl">
          With Ziggo, you can create a personalized AI support agent that meets your Business needs and preferences.
        </span>
        <div className="w-[300px] h-[300px]">
        <Image src="/support.jpg" alt="ai-support" className="w-full h-full" width={300} height={300} />
        </div>

      </div>
    </main>
  );
}
