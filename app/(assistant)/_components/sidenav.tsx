"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import useStore from "@/zustand/use-store";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import React from "react";
import { FiEdit } from "react-icons/fi";
export const SideNav = () => {

  const chatOpen = useStore((state) => state.isOpen)
  const {
    organization: activeOrganization,
    isLoaded: isLoadedOrg
} = useOrganization();
const {
    userMemberships,
    isLoaded : isLoadedOrgList
} = useOrganizationList({
    userMemberships:{
        infinite: true,
    }
})
  return (
    <div className="bg-[#1f2c4e] w-[25%] p-4">
      <div className="flex flex-col">
        <div className="flex justify-between items-center border-b border-b-gray-300 pb-0">
          <h1 className="font-bold text-2xl text-[#e2b9f7]">Ziggo-ChatAI</h1>
          <FiEdit className="text-[#e2b9f7]" />
        </div>

        {isLoadedOrgList && userMemberships?.data?.map((userMembership) => (
          <div key={userMembership.id} role="button" onClick={chatOpen} className="flex p-2 rounded-lg items-center gap-2 mt-4 text-[#e7cfff] hover:bg-[#5d66ad]">
              <Avatar>
              <AvatarImage src={userMembership.organization.imageUrl} alt="drugco" />
              <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <p className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis">Chat With {userMembership.organization.name} Support Agent</p>
          </div>
        ))}
      </div>
    </div>
  );
};
