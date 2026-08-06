import aliyunLogo from "../assets/brand/aliyun.png";
import anthropicLogo from "../assets/brand/anthropic.png";
import deepseekLogo from "../assets/brand/deepseek.png";
import googleLogo from "../assets/brand/google.png";
import openaiLogo from "../assets/brand/openai.png";
import zhipuLogo from "../assets/brand/zhipu.png";

const providerLogos = {
  aliyun: aliyunLogo,
  anthropic: anthropicLogo,
  deepseek: deepseekLogo,
  google: googleLogo,
  openai: openaiLogo,
  zhipu: zhipuLogo,
};

export function ProviderLogo({ providerId, className = "" }) {
  const src = providerLogos[providerId];
  if (!src) return null;

  return (
    <img
      className={`provider-logo provider-logo-${providerId}${className ? ` ${className}` : ""}`}
      src={src}
      alt=""
      draggable="false"
    />
  );
}
