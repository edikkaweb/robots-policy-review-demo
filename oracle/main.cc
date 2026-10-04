// Thin I/O adapter only. The parser/matcher is the unmodified pinned Google source.
#include <iostream>
#include <string>
#include "robots.h"
std::string unhex(const std::string& s) { std::string o; for(size_t i=0;i+1<s.size();i+=2)o+=static_cast<char>(std::stoul(s.substr(i,2),nullptr,16));return o; }
int main(){std::string file,token,url;while(std::getline(std::cin,file)&&std::getline(std::cin,token)&&std::getline(std::cin,url)){googlebot::RobotsMatcher matcher;std::cout<<(matcher.OneAgentAllowedByRobots(unhex(file),unhex(token),unhex(url))?"allow":"disallow")<<"\n";}return 0;}
