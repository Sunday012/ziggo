"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useStore from "@/zustand/use-store";
import { useAuth, useOrganization, useOrganizationList } from "@clerk/nextjs";
import { redirect, useParams } from "next/navigation";
import React, { useState } from "react";

export default function AssistantPage() {
  const [organizationName, setOrganizationName] = useState("")

  const {
    organization: activeOrganization,
    isLoaded: isLoadedOrg
} = useOrganization();


  const { orgId } = useAuth();
  if (!orgId) {
    redirect("/select-org");
  }

  const chatClicked = useStore((state) => state.chatClicked)

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi I'm ${activeOrganization || isLoadedOrg ? activeOrganization?.name : "companies-name"} Support Agent, How can i help you today?`,
    },
  ]);
  const [message, setMessage] = useState("");

  const sendMessage = async () => {
    setMessages([
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);
    setMessage("");

    const data = fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([...messages, { role: "user", content: message }]),
    }).then(async (res) => {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        return reader.read().then(function processText({ done, value }) {
          if (done) {
            return;
          }
          const text = decoder.decode(value || new Int8Array(), {
            stream: true,
          });
          setMessages((messages) => {
            let lastMessage = messages[messages.length - 1];
            let otherMessages = messages.slice(0, messages.length - 1);
            return [
              ...otherMessages,
              {
                ...lastMessage,
                content: lastMessage.content + text,
              },
            ];
          });
          reader.read().then(processText);
        });
      }
    });
  };
  return (
    <div className="flex min-h-screen flex-col bg-[#fdfafc] w-[75%]">
      {chatClicked && (
      <div className="rounded-md flex flex-col justify-between h-[99vh] p-2">
        <div className="overflow-auto gap-2 w-full flex flex-col">
          {messages.map((message, id) => (
            <div
              key={id}
              className={`flex w-full pt-4 ${
                message.role === "assistant"
                  ? "justify-start items-start"
                  : "justify-end items-end"
              }`}
            >
              <div
                className={`w-[60%] flex ${
                  message.role === "assistant"
                    ? "justify-start items-start"
                    : "justify-end items-end"
                }`}
              >
                <div
                  className={`rounded-2xl py-2 px-4 font-medium w-fit ${
                    message.role === "assistant"
                      ? "bg-[#5d66ad] text-white"
                      : "bg-[#1f2c4e] text-white"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 p-2 ">
          <Input
            onChange={(e) => setMessage(e.target.value)}
            value={message}
            placeholder="Type Your Message"
            className="focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-ring focus-visible:ring-offset-0"
          />
          <Button onClick={sendMessage} className="bg-[#1f2c4e]">Send Message</Button>
        </div>
      </div>
      )}
    </div>
  );
}
