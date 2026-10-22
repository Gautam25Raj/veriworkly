"use client";

import React, { useState } from "react";

import { ContactForm } from "./components/ContactForm";
import { ContactFaqSidebar } from "./components/ContactFaqSidebar";
import { ContactSuccessModal, type ContactSuccessData } from "./components/ContactSuccessModal";

export const ContactExperience = () => {
  const [successData, setSuccessData] = useState<ContactSuccessData | null>(null);

  return (
    <>
      <div className="grid gap-12 lg:grid-cols-[1.25fr_.75fr] lg:gap-16">
        <ContactForm onSuccess={setSuccessData} />
        <ContactFaqSidebar />
      </div>

      <ContactSuccessModal data={successData} onClose={() => setSuccessData(null)} />
    </>
  );
};

export default ContactExperience;
